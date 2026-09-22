package performance;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.gatling.javaapi.core.ChainBuilder;
import io.gatling.javaapi.core.PopulationBuilder;
import io.gatling.javaapi.core.Simulation;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import static io.gatling.javaapi.core.CoreDsl.*;
import static io.karatelabs.gatling.KarateDsl.*;
import io.gatling.javaapi.core.OpenInjectionStep;

public class PerformanceSimulation extends Simulation {

    {

        Path generatedDir =
                Paths.get("build/generated-performance");

        try {

            Files.createDirectories(generatedDir);

        } catch (IOException e) {

            throw new RuntimeException(e);
        }

        String tags =
                System.getProperty("karate.tags");

        var protocol = karateProtocol();

        List<PopulationBuilder> populations =
                new ArrayList<>();

        List<GeneratedFeature> features =
                generateFeatures(tags);

        for (GeneratedFeature generatedFeature : features) {

            String content =
                    generatedFeature.getContent();

            PerformanceConfig config =
                    extractPerformanceConfig(content);

            System.setProperty(
                    "feeder.file",
                    config.getFeeder()
            );

            System.setProperty(
                    "feeder.strategy",
                    config.getStrategy()
            );

            ChainBuilder chain = exec(
                    karateFeature(
                            generatedFeature.getFeaturePath()
                    ).tags(tags)
            );

            populations.add(

                    scenario(
                            generatedFeature.getFeaturePath()
                    )
                            .exec(chain)
                            .injectOpen(

                                    constantUsersPerSec(
                                            config
                                                    .getInjection()
                                                    .getUsers()
                                    ).during(

                                            config
                                                    .getInjection()
                                                    .getDuration()
                                    )

                            )
            );
        }

        setUp(populations)
                .protocols(protocol);
    }

    private List<GeneratedFeature> generateFeatures(
            String tag
    ) {

        List<GeneratedFeature> generated =
                new ArrayList<>();

        try (
                Stream<Path> paths =
                        Files.walk(
                                Paths.get(
                                        "src/test/resources/features"
                                )
                        )
        ) {

            paths
                    .filter(Files::isRegularFile)
                    .filter(
                            path ->
                                    path.toString()
                                            .endsWith(".feature")
                    )
                    .forEach(path -> {

                        try {

                            List<String> lines =
                                    Files.readAllLines(path);

                            for (int i = 0; i < lines.size(); i++) {

                                String line =
                                        lines.get(i);

                                if (line.contains(tag)) {

                                    System.out.println(
                                            "TAG ENCONTRADO -> " + path
                                    );

                                    int startIndex = i;

                                    while (
                                            startIndex > 0 &&
                                                    lines
                                                            .get(startIndex - 1)
                                                            .trim()
                                                            .startsWith("@")
                                    ) {

                                        startIndex--;
                                    }

                                    StringBuilder scenarioContent =
                                            new StringBuilder();

                                    scenarioContent.append(
                                            """
                                            Feature: Generated Performance Feature
                                            
                                            Background:
                                                Given url baseUrl
                                            
                                            """
                                    );

                                    boolean scenarioStarted =
                                            false;

                                    for (
                                            int j = startIndex;
                                            j < lines.size();
                                            j++
                                    ) {

                                        String current =
                                                lines.get(j).trim();

                                        if (
                                                !scenarioStarted &&
                                                        current.startsWith("@")
                                        ) {

                                            scenarioContent
                                                    .append(lines.get(j))
                                                    .append("\n");
                                        }

                                        if (
                                                current.startsWith("Scenario")
                                        ) {

                                            if (scenarioStarted) {

                                                break;
                                            }

                                            scenarioStarted = true;
                                        }

                                        if (scenarioStarted) {

                                            scenarioContent
                                                    .append(lines.get(j))
                                                    .append("\n");
                                        }
                                    }

                                    String generatedName =
                                            "build/generated-performance/perf-" +
                                                    System.nanoTime() +
                                                    ".feature";

                                    //System.out.println(scenarioContent);

                                    Files.writeString(
                                            Paths.get(generatedName),
                                            scenarioContent.toString()
                                    );

                                    generated.add(

                                            new GeneratedFeature(
                                                    generatedName,
                                                    scenarioContent.toString()
                                            )
                                    );
                                }
                            }

                        } catch (IOException e) {

                            throw new RuntimeException(e);
                        }
                    });

        } catch (IOException e) {

            throw new RuntimeException(e);
        }

        return generated;
    }

    private PerformanceConfig extractPerformanceConfig(
            String content
    ) {

        try {

            Pattern pattern = Pattern.compile(
                    "\\* def performance =\\s*\"\"\"(.*?)\"\"\"",
                    Pattern.DOTALL
            );

            Matcher matcher =
                    pattern.matcher(content);

            if (!matcher.find()) {

                throw new RuntimeException(
                        "Performance config not found"
                );
            }

            String json =
                    matcher.group(1).trim();

            ObjectMapper mapper =
                    new ObjectMapper();

            return mapper.readValue(
                    json,
                    PerformanceConfig.class
            );

        } catch (Exception e) {

            throw new RuntimeException(e);
        }
    }

    private OpenInjectionStep buildInjection(PerformanceConfig config) {

        String type = config.getInjection().getType();

        int users = config.getInjection().getUsers();
        int duration = config.getInjection().getDuration();
        int rampUp = config.getInjection().getRampUp();

        switch (type.toLowerCase()) {
            case "ramp":
                return rampUsersPerSec(1)
                        .to(users)
                        .during(rampUp);
            case "spike":
                return stressPeakUsers(users)
                        .during(duration);
            case "soak":
                return constantUsersPerSec(users).during(duration);
            case "stress":
                return rampUsersPerSec(1).to(users).during(duration);
            case "constant":
            default:
                return constantUsersPerSec(users).during(duration);
        }
    }
}