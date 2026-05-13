Feature: Accounts

  Background:
    Given url baseUrl


  @smokes
  Scenario: Get Account Balance
    Given path 'users/1'
    When method GET
    Then status 200

  @load_medium
  @performance_accounts2
  Scenario: Get Account Balance Performance
    Given path 'users/1'
    When method GET
    Then status 200