
Feature: Get Post
  Background:
    Given url baseUrl

  @load_medium
  @performance_accounts1
  Scenario: GET post
    Given path 'posts/1'
    When method GET
    Then status 200