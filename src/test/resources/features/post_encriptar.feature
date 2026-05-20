@api-autenticacion-usuario @api-autenticacion-usuario-encriptar
Feature: API-AUTENTICACION-USUARIOS-ENCRIPTAR
  Background:
    * url pathBaseGKE

    @encriptarClave
    Scenario: API-AUTENTICACION-ENCRIPTAR
      * def fixedClave = '5678'
      * def clave = clave ? clave : fixedClave
      Given path 'autenticacion', 'usuarios', 'v2', 'encriptar'
      And request
      """
        {
          "claveEnClaro": '#(clave)'
        }
      """
      When method POST
      Then status 200
      * def encriptada = response.claveEncriptada