
Feature: Get Post
  Background:
    Given url baseUrl


  @smokes
  Scenario: GET post
    Given path 'posts/1'
    When method GET
    Then status 200