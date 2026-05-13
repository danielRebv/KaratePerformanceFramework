@plan:12312312
@suite:123213124
Feature: Accounts

  Background:
    Given url baseUrl


  @regresion
  @tc:balance_001
  Scenario: Get Account Balance
    Given path 'users/a'
    When method GET
    Then status 200


  @smokes
  Scenario: Get Account Balance Performance
    Given path 'users/a'
    When method GET
    Then status 200