package performance;

public class InjectionConfig {

    private String type;
    private int users;
    private int duration;
    private int rampUp;

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public int getUsers() {
        return users;
    }

    public void setUsers(int users) {
        this.users = users;
    }

    public int getDuration() {
        return duration;
    }

    public void setDuration(int duration) {
        this.duration = duration;
    }

    public int getRampUp() {
        return rampUp;
    }

    public void setRampUp(int rampUp) {
        this.rampUp = rampUp;
    }
}