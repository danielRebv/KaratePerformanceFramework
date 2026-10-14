package review.parser;

import review.context.reviewContext;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public class featureFileCollector {

    public List<Path> collect(
            reviewContext context) {

        List<Path> features =
                new ArrayList<>();

        try {

            String targetBranch =
                    context.targetBranch();

            if (targetBranch == null ||
                    targetBranch.isBlank()) {

                targetBranch = "develop";
            }

            System.out.println(
                    "TARGET BRANCH: "
                            + targetBranch
            );

            Process process =
                    new ProcessBuilder(
                            "git",
                            "diff",
                            "--diff-filter=AM",
                            "--name-only",
                            "origin/" + targetBranch + "...HEAD"
                    ).start();

            try (BufferedReader reader =
                         new BufferedReader(
                                 new InputStreamReader(
                                         process.getInputStream()
                                 ))) {

                String line;

                while ((line = reader.readLine()) != null) {

                    System.out.println(
                            "MODIFIED FILE: "
                                    + line
                    );

                    if (!line.endsWith(".feature")) {
                        continue;
                    }

                    Path feature =
                            Path.of(line);

                    if (Files.exists(feature)) {

                        features.add(feature);
                    } else {

                        System.out.println(
                                "IGNORADO (NO EXISTE): "
                                        + feature
                        );
                    }
                }
            }

            process.waitFor();

            System.out.println(
                    "FEATURES DETECTADAS: "
                            + features.size()
            );

            features.forEach(path ->
                    System.out.println(
                            "FEATURE => "
                                    + path.toAbsolutePath()
                    )
            );

        } catch (Exception e) {

            throw new RuntimeException(
                    "Error obteniendo features modificadas",
                    e
            );
        }

        return features;
    }
}
