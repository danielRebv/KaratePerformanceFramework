package review.rules;

import review.context.reviewContext;
import review.model.featureDocument;
import review.model.scenarioDocument;
import review.model.severity;
import review.model.violation;

import java.util.ArrayList;
import java.util.List;

public class mandatoryTagsRule
        implements reviewRule {

    @Override
    public List<violation> validate(
            reviewContext context,
            List<featureDocument> features) {

        List<violation> violations =
                new ArrayList<>();

        for (featureDocument feature : features) {

            for (scenarioDocument scenario :
                    feature.scenarios()) {

                boolean hasTestCase =
                        scenario.tags()
                                .stream()
                                .anyMatch(tag ->
                                        tag.equals("@TestCase=NEW"));

                boolean hasTagAdo =
                        scenario.tags()
                                .stream()
                                .anyMatch(tag ->
                                        tag.startsWith("@tagADO="));

                if (!hasTestCase) {

                    violations.add(
                            new violation(
                                    "RULE-006",
                                    feature.featureName(),
                                    scenario.line(),
                                    severity.BLOCKER,
                                    "Falta tag obligatorio @TestCase=NEW",
                                    "Agregar @TestCase=NEW sobre el Scenario"
                            )
                    );
                }

                if (!hasTagAdo) {

                    violations.add(
                            new violation(
                                    "RULE-006",
                                    feature.featureName(),
                                    scenario.line(),
                                    severity.BLOCKER,
                                    "Falta tag obligatorio @tagADO",
                                    "Agregar @tagADO={HU}"
                            )
                    );
                }
            }
        }

        return violations;
    }
}