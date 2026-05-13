Feature: Health Check

  Background:
    Given url baseUrl

  Scenario: GET user
    Given path 'users/1'
    When method GET
    Then status 200