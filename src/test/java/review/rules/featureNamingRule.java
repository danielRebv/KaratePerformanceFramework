package review.rules;

import review.context.reviewContext;
import review.model.featureDocument;
import review.model.severity;
import review.model.violation;

import java.util.ArrayList;
import java.util.List;

public class featureNamingRule implements reviewRule {

    @Override
    public List<violation> validate(
            reviewContext context,
            List<featureDocument> features) {

        List<violation> violations =
                new ArrayList<>();

        for (featureDocument feature : features) {

            String fileName =
                    feature.path()
                            .getFileName()
                            .toString();

            boolean valid =
                    fileName.matches(
                            "^(get|post|put|patch|delete)_.*\\.feature$"
                    );

            if (!valid) {

                violations.add(
                        new violation(
                                "RULE-002",
                                fileName,
                                0,
                                severity.BLOCKER,
                                "Nombre de feature inválido",
                                "Ejemplo: post_crear_cliente.feature"
                        )
                );
            }
        }

        return violations;
    }
}