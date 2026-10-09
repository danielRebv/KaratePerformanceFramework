package review.rules;

import review.context.reviewContext;
import review.model.featureDocument;
import review.model.scenarioDocument;
import review.model.severity;
import review.model.violation;

import java.util.ArrayList;
import java.util.List;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class branchTagConsistencyRule
        implements reviewRule {

    @Override
    public List<violation> validate(
            reviewContext context,
            List<featureDocument> features) {

        List<violation> violations =
                new ArrayList<>();

        String branch =
                context.branchName();

        String artifact =
                getArtifact(branch);

        for (featureDocument feature : features) {

            for (scenarioDocument scenario :
                    feature.scenarios()) {

                String tagAdo = null;

                for (String tag :
                        scenario.tags()) {

                    if (tag.startsWith("@tagADO=")) {

                        tagAdo =
                                tag.replace(
                                        "@tagADO=",
                                        ""
                                );
                    }
                }

                if (tagAdo == null ||
                        scenario.responseStatus() == null) {
                    continue;
                }


                String expectedTag =
                        artifact
                                + "_"
                                + scenario.responseStatus();

                if (!expectedTag.equalsIgnoreCase(tagAdo)) {

                    violations.add(
                            new violation(
                                    "RULE-007",
                                    feature.featureName(),
                                    scenario.line(),
                                    severity.BLOCKER,
                                    "TagADO inconsistente",
                                    "Usar @tagADO="
                                            + expectedTag
                                            + " (actual: @tagADO="
                                            + tagAdo
                                            + ")"
                            )
                    );
                }
            }
        }

        return violations;
    }

    private String getArtifact(
            String branch) {

        Pattern pattern =
                Pattern.compile(
                        "^feat\\/\\d+_([A-Za-z0-9]+)_v\\d+$"
                );

        Matcher matcher =
                pattern.matcher(branch);

        if (matcher.matches()) {

            return matcher.group(1);
        }

        return "UNKNOWN";
    }
}
