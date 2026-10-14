package review.context;

import java.util.List;

public class reviewContextBuilder {

    public reviewContext build() {

        String branchName =
                System.getenv("GITHUB_HEAD_REF");

        String source =
                System.getenv("GITHUB_HEAD_REF");

        String target =
                System.getenv("GITHUB_BASE_REF");

        if (branchName == null || branchName.isBlank()) {
            branchName = "feat/12345_apiCreditoConsumo_v1";
        }

        String targetBranch =
                System.getenv("GITHUB_BASE_REF");

        return new reviewContext(
                branchName,
                "develop",
                List.of()
        );
    }
}