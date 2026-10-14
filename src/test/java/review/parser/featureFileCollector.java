package review.parser;

import review.context.reviewContext;

import java.io.BufferedReader;
import java.io.InputStreamReader;
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

                System.out.println(
                        "TARGET BRANCH: "
                                + targetBranch
                );



                targetBranch = "develop";
            }

            Process process =
                    new ProcessBuilder(
                            "git",
                            "diff",
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

                    if (line.endsWith(".feature")) {

                        features.add(
                                Path.of(line)
                        );
                    }
                }
            }

            process.waitFor();

        } catch (Exception e) {

            throw new RuntimeException(
                    "Error obteniendo features modificadas",
                    e
            );
        }

        return features;
    }
}