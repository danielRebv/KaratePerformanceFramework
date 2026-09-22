Feature: Health Check

  Background:
    Given url baseUrl

  @regresion
  Scenario: GET user
    Given path 'users/1'
    When method GET
    Then status 200