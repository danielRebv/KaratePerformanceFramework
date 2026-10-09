function fn() {

    karate.configure('ssl', true);
    var host = karate.read('classpath:config/host.json');
    var aut = karate.read('classpath:config/aut.json');


    var config = {};

    karate.configure('logging', {
        pretty: false,
        showAllSteps: false
    });

    karate.configure('ssl', {
        trustAll: true
    });

    //servidores
    config.urls = host;
    config.auth = aut;

    return config;
}