package performance;

public class PerformanceConfig {

    private String feeder;
    private String strategy;

    private InjectionConfig injection;

    public String getFeeder() {
        return feeder;
    }

    public void setFeeder(String feeder) {
        this.feeder = feeder;
    }

    public String getStrategy() {
        return strategy;
    }

    public void setStrategy(String strategy) {
        this.strategy = strategy;
    }

    public InjectionConfig getInjection() {
        return injection;
    }

    public void setInjection(
            InjectionConfig injection
    ) {
        this.injection = injection;
    }
}