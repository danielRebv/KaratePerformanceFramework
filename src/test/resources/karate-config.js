function fn() {
    var config = {};

    karate.configure('logging', {
        pretty: false,
        showAllSteps: false
    });

    config.baseUrl = 'https://jsonplaceholder.typicode.com';
    config.pathBaseGKE = 'https://apiqa-int.bice.local';

    karate.log(config)
    return config;
}