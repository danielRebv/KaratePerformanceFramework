package review.runners;

import review.engine.pullRequestReviewEngine;
import review.model.reviewResult;
import review.model.violation;

import java.io.IOException;

public class pullRequestReviewRunner {

    public static void main(String[] args) throws IOException {

        System.out.println("=== INICIO QA REVIEW ===");

        pullRequestReviewEngine engine =
                new pullRequestReviewEngine();

        reviewResult result =
                engine.execute();

        System.out.println("Approved : " + result.approved());
        System.out.println("Blockers : " + result.blockers());
        System.out.println("Warnings : " + result.warnings());

        for (violation violation : result.violations()) {

            System.out.println("----------");
            System.out.println("Rule      : " + violation.ruleCode());
            System.out.println("File      : " + violation.file());
            System.out.println("Severity  : " + violation.severity());
            System.out.println("Message   : " + violation.message());
            System.out.println("Proposal  : " + violation.proposal());
            System.out.println("Line      : " + violation.line());

        }

        if (!result.approved()) {

            result.violations().forEach(v -> {

                System.out.println("RULE : " + v.ruleCode());
                System.out.println("FILE : " + v.file());
                System.out.println("LINE : " + v.line());
                System.out.println("ERROR: " + v.message());
                System.out.println("FIX  : " + v.proposal());
                System.out.println("--------------------------------");
            });

            throw new RuntimeException(
                    "QA Review Failed. Blockers: "
                            + result.blockers()
            );
        }

        System.out.println("QA Review Passed");
    }
}