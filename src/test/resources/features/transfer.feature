Feature: Accounts

  Background:
    Given url baseUrl


  Scenario: Get Account Balance
    Given path 'users/2'
    When method GET
    Then status 200


  Scenario: Get Account Balance Performance
    Given path 'users/2'
    When method GET
    Then status 200