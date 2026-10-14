package review.report;

import review.model.reviewResult;
import review.model.violation;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public class markdownReportBuilder {

    public void build(
            reviewResult result) {

        StringBuilder builder =
                new StringBuilder();

        builder.append("# QA PR Review\n\n");

        builder.append("## Resultado\n\n");

        builder.append(
                result.approved()
                        ? "✅ PASSED\n\n"
                        : "❌ FAILED\n\n"
        );

        builder.append(
                "Blockers: "
        ).append(
                result.blockers()
        ).append(
                "\n\n"
        );

        for (violation violation :
                result.violations()) {

            builder.append("---\n\n");

            builder.append("## ")
                    .append(
                            violation.ruleCode()
                    )
                    .append("\n\n");

            builder.append("**Archivo:** ")
                    .append(
                            violation.file()
                    )
                    .append("\n\n");

            builder.append("**Línea:** ")
                    .append(
                            violation.line()
                    )
                    .append("\n\n");

            builder.append("**Error:** ")
                    .append(
                            violation.message()
                    )
                    .append("\n\n");

            builder.append("**Propuesta:** ")
                    .append(
                            violation.proposal()
                    )
                    .append("\n\n");
        }

        try {

            Files.createDirectories(
                    Path.of("build")
            );

            Files.writeString(
                    Path.of(
                            "build",
                            "pr-review-report.md"
                    ),
                    builder.toString()
            );

        } catch (IOException e) {

            throw new RuntimeException(
                    "Error generando reporte markdown",
                    e
            );
        }
    }
}