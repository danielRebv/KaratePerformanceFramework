package runners;


import io.karatelabs.core.Runner;
import io.karatelabs.core.SuiteResult;
import static org.junit.jupiter.api.Assertions.assertFalse;

public class ApiRunner {

    @org.junit.jupiter.api.Test
    void testApi() {

        String tags =
                System.getProperty(
                        "karate.tags"
                );

        Runner.Builder runner =
                Runner.path(
                                "classpath:features"
                        )
                        .outputHtmlReport(true)
                        .outputJunitXml(true)
                        .outputCucumberJson(true);

        if (tags != null) {

            runner.tags(tags);
        }

        SuiteResult results =
                runner.parallel(1);

        assertFalse(
                results.isFailed(),
                "Karate tests failed"
        );

    }
}