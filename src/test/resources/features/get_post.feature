Feature: Get Post

  Background:
    Given url baseUrl


  @perf
  Scenario: GET post
    * java.lang.System.setProperty('feeder.file', 'ruts.csv')
    * def performance =
      """
      {
        "feeder": "ruts.csv",
        "strategy": "sequential",

        "injection": {
          "type": "constant",
          "users": 5,
          "duration": 5,
          "rampUp": 0
        }
      }
      """
    * def userId = Java.type('performance.CsvUtils').feeder('userId',performance.strategy)
    Given path 'posts', userId
    When method GET
    Then status 200




  Scenario: GET user
    * java.lang.System.setProperty('feeder.file', 'usuarios.csv')
    * def performance =
      """
      {
        "feeder": "usuarios.csv",
        "strategy": "sequential",

        "injection": {
          "type": "constant",
          "users": 5,
          "duration": 5,
          "rampUp": 0
        }
      }
      """
    * def data = Java.type('performance.CsvUtils').row(performance.strategy)
    * print 'DATA ->', data
    * def userId = data.userId
    * def expectedUsername = data.username
    * def expectedName = data.name
    Given path 'users', userId
    When method GET
    Then status 200
    And match response.username == expectedUsername
    And match response.name == expectedName




  Scenario: User flow
    * java.lang.System.setProperty('feeder.file', 'usuarios.csv')
    * def performance =
      """
      {
        "feeder": "usuarios.csv",
        "strategy": "sequential",

        "injection": {
          "type": "constant",
          "users": 5,
          "duration": 5,
          "rampUp": 0
        }
      }
      """
    * def data = Java.type('performance.CsvUtils').row(performance.strategy)
    * def userId = data.userId
    * def expectedUsername = data.username
    Given path 'users', userId
    When method GET
    Then status 200
    And match response.username == expectedUsername
    * def companyName = response.company.name
    Given path 'posts'
    And param userId = userId
    When method GET
    Then status 200


  Scenario: Create post
    * java.lang.System.setProperty('feeder.file', 'usuarios.csv')
    * def performance =
      """
      {
        "feeder": "usuarios.csv",
        "strategy": "random",

        "injection": {
          "type": "constant",
          "users": 5,
          "duration": 5,
          "rampUp": 0
        }
      }
      """

    * def data = Java.type('performance.CsvUtils').row(performance.strategy)

    Given path 'posts'

    And request
      """
      {
    userId: #(data.userId),
    title: '#(data.username)',
    body: '#(data.name)'
    }
    """
    When method POST
    Then status 201
    And match response.userId == data.userId
    And match response.title == data.username
    And match response.body == data.name