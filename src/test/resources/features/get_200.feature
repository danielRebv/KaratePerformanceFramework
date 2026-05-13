
Feature: Get Post
  Background:
    Given url baseUrl


  @regresion
  Scenario: GET post
    Given path 'posts/1'
    When method GET
    Then status 200