@integracion @api-autenticacion-usuarios @api-autenticacion-usuarios-validar
Feature: API-AUTENTICACION-USUARIOS-VALIDAR
  Background:
    * url pathBaseGKE
    * def apiAutenticacionEncriptar = read('classpath:features/post_encriptar.feature@encriptarClave')

    @performance=autenticacion-usuarios-validar @env=perf @validar
      Scenario: Performance api-autenticacion-usuarios-validar
      * def rutPerf = '0060623538'
      * def rutUsuario = rutPerf
      * def rutCliente = rutPerf
      * def clavePerf = '5678'
      * def encriptar = call apiAutenticacionEncriptar {'clave': '#(clavePerf)'}
      * header Content-Type = 'application/json'
      * header x-rut-usuario = rutUsuario
      * header x-rut-cliente = rutCliente
      * header trx-canal = 'IP'
      * header trx-id = 'abc123'
      * header tipo-login = 'IP'
      * def schema =
      """
        {
          "tipoUsuario": "#string"
        }
      """
      Given path 'autenticacion', 'usuarios', 'v2', 'validar'
      And request
      """
        {
          "clave": '#(encriptar.encriptada)'
        }
      """
      When method POST
      Then status 200
      And match response == schema

      @testCase=NEW
      @tagADO=apiAutenticacionValidar_200 @regresion
        Scenario Outline: api-autenticacion-usuarios-validar - status 200
        * def clave = '5678'
        * def encriptar = call apiAutenticacionEncriptar {'clave': '#(clave)'}
        * header Content-Type = 'application/json'
        * header x-rut-usuario = '<rutUsuario>'
        * header x-rut-cliente = '<rutCliente>'
        * header trx-canal = '<canal>'
        * header trx-id = '<id>'
        * header tipo-login = 'IP'
        Given path 'autenticacion', 'usuarios', 'v2', 'validar'
        And request
      """
        {
          'clave': #(encriptar.encriptada)
        }
      """
        When method POST
        Then status 200
        And response.tipoUsuario = '<tipoUsuario>'
        Examples:
          |rutUsuario|rutCliente |canal|id    |tipoUsuario    |
          |0093513665|0093513665 |IP   |abc123|USUARIO_PERSONA|
          |0104625568|0104625568 |IP   |abc123|USUARIO_PERSONA|
          |013441961K|013441961K |IP   |abc123|USUARIO_PERSONA|
          |013441961k|013441961k |IP   |abc123|USUARIO_PERSONA|
          |52719224  |52719224   |IP   |null  |USUARIO_PERSONA|
          |0052719224|           |IP   |abc123|USUARIO_PERSONA|
          |52719224  |52719224   |IP   |      |USUARIO_PERSONA|
          |0052719224|0052719224 |IP   |IDD   |USUARIO_PERSONA|
          |000000000  |0052719224|IP   |abc123|USUARIO_PERSONA|
          |0052719224 |0052719224|none |abc123|USUARIO_PERSONA|
          |0052719224 |0052719224|IP   |none  |USUARIO_PERSONA|