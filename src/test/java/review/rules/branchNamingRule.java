package review.rules;

import review.context.reviewContext;
import review.model.featureDocument;
import review.model.severity;
import review.model.violation;

import java.util.List;
import java.util.regex.Pattern;

public class branchNamingRule implements reviewRule {

    private static final Pattern PATTERN =
            Pattern.compile(
                    "^feat\\/\\d+_(api|ms|bff)[A-Za-z0-9]*_v\\d+$"
            );

    @Override
    public List<violation> validate(
            reviewContext context,
            List<featureDocument> features) {

        String branch =
                context.branchName();

        if (branch == null ||
                !PATTERN.matcher(branch).matches()) {

            return List.of(
                    new violation(
                            "RULE-001",
                            "BRANCH",
                            0,
                            severity.BLOCKER,
                            "Nombre de rama inválido",
                            "Formato esperado: feat/{HU}_{api|ms|bff}_v{n}"
                    )
            );
        }

        return List.of();
    }
}