package review.context;

import java.util.List;

public class reviewContextBuilder {

    public reviewContext build() {

        String branchName =
                System.getenv("GITHUB_HEAD_REF");

        String targetBranch =
                System.getenv("GITHUB_BASE_REF");

        System.out.println(
                "HEAD REF: " + branchName
        );

        System.out.println(
                "BASE REF: " + targetBranch
        );

        // Ejecución local
        if (branchName == null || branchName.isBlank()) {

            branchName =
                    "feat/12345_apiCreditoConsumo_v1";
        }

        if (targetBranch == null || targetBranch.isBlank()) {

            targetBranch =
                    "develop";
        }

        return new reviewContext(
                branchName,
                targetBranch,
                List.of()
        );
    }
}