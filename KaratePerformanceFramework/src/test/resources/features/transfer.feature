Feature: Accounts

  Background:
    Given url baseUrl

  @regresion
  Scenario: Get Account Balance
    Given path 'users/1'
    When method GET
    Then status 200

  @regresion
  Scenario: Get Account Balance Performance
    Given path 'users/2'
    When method GET
    Then status 200