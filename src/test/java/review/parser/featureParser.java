package review.parser;

import review.model.featureDocument;
import review.model.scenarioDocument;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class featureParser {

    public featureDocument parse(Path featureFile) {

        try {

            List<String> content =
                    Files.readAllLines(featureFile);

            List<scenarioDocument> scenarios =
                    new ArrayList<>();

            List<String> pendingTags =
                    new ArrayList<>();

            int backgroundCount = 0;
            int featureCount = 0;

            String currentScenarioName = null;
            Integer currentScenarioLine = null;
            Integer currentStatus = null;
            List<String> currentScenarioTags =
                    new ArrayList<>();

            Pattern statusPattern =
                    Pattern.compile(
                            "Then\\s+status\\s+(\\d+)"
                    );

            for (int i = 0; i < content.size(); i++) {

                String line =
                        content.get(i).trim();

                if (line.startsWith("Feature:")) {
                    featureCount++;
                }

                if (line.startsWith("Background:")) {
                    backgroundCount++;
                }

                if (line.startsWith("@")) {

                    pendingTags.add(line);
                    continue;
                }

                if (line.startsWith("Scenario:")
                        || line.startsWith("Scenario Outline:")) {

                    // Guarda escenario anterior
                    if (currentScenarioName != null) {

                        scenarios.add(
                                new scenarioDocument(
                                        currentScenarioName,
                                        currentScenarioLine,
                                        currentScenarioTags,
                                        currentStatus
                                )
                        );
                    }

                    currentScenarioName =
                            line.substring(
                                            line.indexOf(":") + 1
                                    )
                                    .trim();

                    currentScenarioLine =
                            i + 1;

                    currentScenarioTags =
                            new ArrayList<>(pendingTags);

                    pendingTags.clear();

                    currentStatus = null;

                    continue;
                }

                Matcher matcher =
                        statusPattern.matcher(line);

                if (matcher.find()) {

                    currentStatus =
                            Integer.parseInt(
                                    matcher.group(1)
                            );
                }
            }

            // Guarda último escenario
            if (currentScenarioName != null) {

                scenarios.add(
                        new scenarioDocument(
                                currentScenarioName,
                                currentScenarioLine,
                                currentScenarioTags,
                                currentStatus
                        )
                );
            }

            return new featureDocument(
                    featureFile.getFileName().toString(),
                    featureFile,
                    1,
                    backgroundCount > 0,
                    backgroundCount,
                    featureCount,
                    List.of(),
                    scenarios,
                    content
            );

        } catch (IOException e) {

            throw new RuntimeException(
                    "Error leyendo feature: "
                            + featureFile,
                    e
            );
        }
    }
}