function fn() {

    karate.configure('logging', {
        pretty: false,
        showAllSteps: false
    });

    return {
        baseUrl: 'https://jsonplaceholder.typicode.com'
    };
}