package review.rules;

import review.context.reviewContext;
import review.model.featureDocument;
import review.model.severity;
import review.model.violation;

import java.util.ArrayList;
import java.util.List;

public class backgroundRequiredRule
        implements reviewRule {

    @Override
    public List<violation> validate(
            reviewContext context,
            List<featureDocument> features) {

        List<violation> violations =
                new ArrayList<>();

        for (featureDocument feature : features) {

            if (!feature.hasBackground()) {

                violations.add(
                        new violation(
                                "RULE-011",
                                feature.featureName(),
                                feature.featureLine(),
                                severity.BLOCKER,
                                "Feature sin Background",
                                "Agregar un bloque Background para centralizar configuración común"
                        )
                );
            }
        }

        return violations;
    }
}