package runners;

import io.karatelabs.junit6.Karate;

public class ApiRunner {

    @Karate.Test
    Karate testApi() {

        String tags = System.getProperty("karate.tags");
        Karate karate = Karate.run("classpath:features");

        if (tags != null) {
            karate.tags(tags);
        }

        return karate;
    }
}