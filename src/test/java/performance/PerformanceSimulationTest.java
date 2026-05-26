package performance;

import io.gatling.core.controller.inject.open.ConstantRateOpenInjection;
import io.gatling.core.controller.inject.open.OpenInjectionStep;
import io.gatling.core.controller.inject.open.RampRateOpenInjection;
import io.gatling.core.controller.inject.open.StressPeakUsersOpenInjection;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PerformanceSimulationTest {

    @Test
    void generateFeaturesReturnsOnlyTaggedScenarios() {
        List<GeneratedFeature> generated = PerformanceSimulation.generateFeatures("@perf");

        assertEquals(1, generated.size());

        GeneratedFeature feature = generated.getFirst();

        assertTrue(feature.getFeaturePath().startsWith("build/generated-performance/perf-"));
        assertTrue(feature.getContent().contains("Feature: Generated Performance Feature"));
        assertTrue(feature.getContent().contains("@perf"));
        assertTrue(feature.getContent().contains("Scenario: GET post"));
        assertTrue(feature.getContent().contains("Given path 'posts', userId"));
        assertTrue(!feature.getContent().contains("Scenario: GET user"));
    }

    @Test
    void generateFeaturesReturnsMultipleMatchesForRepeatedTags() {
        List<GeneratedFeature> generated = PerformanceSimulation.generateFeatures("@accounts");

        assertEquals(2, generated.size());
    }

    @Test
    void extractPerformanceConfigParsesNestedInjectionValues() {
        String content = """
                Feature: Generated Performance Feature

                Scenario: GET post
                  * def performance =
                    \"\"\"
                    {
                      "feeder": "usuarios.csv",
                      "strategy": "random",
                      "injection": {
                        "type": "stress",
                        "users": 8,
                        "duration": 13,
                        "rampUp": 5
                      }
                    }
                    \"\"\"
                """;

        PerformanceConfig config = PerformanceSimulation.extractPerformanceConfig(content);

        assertEquals("usuarios.csv", config.getFeeder());
        assertEquals("random", config.getStrategy());
        assertNotNull(config.getInjection());
        assertEquals("stress", config.getInjection().getType());
        assertEquals(8, config.getInjection().getUsers());
        assertEquals(13, config.getInjection().getDuration());
        assertEquals(5, config.getInjection().getRampUp());
    }

    @Test
    void extractPerformanceConfigFailsWhenBlockIsMissing() {
        RuntimeException exception = assertThrows(
                RuntimeException.class,
                () -> PerformanceSimulation.extractPerformanceConfig("Feature: No performance block")
        );

        assertInstanceOf(RuntimeException.class, exception.getCause());
        assertTrue(exception.getCause().getMessage().contains("Performance config not found"));
    }

    @Test
    void buildInjectionCreatesTheExpectedInjectionStepTypes() {
        assertInstanceOf(
                ConstantRateOpenInjection.class,
                PerformanceSimulation.buildInjection(config("constant"))
        );
        assertInstanceOf(
                RampRateOpenInjection.class,
                PerformanceSimulation.buildInjection(config("ramp"))
        );
        assertInstanceOf(
                StressPeakUsersOpenInjection.class,
                PerformanceSimulation.buildInjection(config("spike"))
        );
        assertInstanceOf(
                ConstantRateOpenInjection.class,
                PerformanceSimulation.buildInjection(config("soak"))
        );
        assertInstanceOf(
                RampRateOpenInjection.class,
                PerformanceSimulation.buildInjection(config("stress"))
        );
        assertInstanceOf(
                ConstantRateOpenInjection.class,
                PerformanceSimulation.buildInjection(config("unsupported"))
        );
    }

    private PerformanceConfig config(String type) {
        InjectionConfig injection = new InjectionConfig();
        injection.setType(type);
        injection.setUsers(5);
        injection.setDuration(10);
        injection.setRampUp(3);

        PerformanceConfig config = new PerformanceConfig();
        config.setFeeder("usuarios.csv");
        config.setStrategy("sequential");
        config.setInjection(injection);
        return config;
    }
}
