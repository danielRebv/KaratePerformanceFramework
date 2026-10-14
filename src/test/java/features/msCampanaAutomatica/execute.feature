Scenario: Crear campaña
          * def body =
          """
                  {
                    "customerRut": '#(rutFromateado)',
                    "productCode": 'TCGOCL',
                    "incomeType": 'PR',
                    "evaluationType": '1',
                    "currencyCode": '0',
                    "divIncome": '#(montoCampana)',
                    "incomeExtractionDate": '#(today)',
                    "previredServiceDetail": "<renta><detalle>Prueba_Postman</detalle></renta>"
                  }
                """

  Scenario:
Given path 'ms-campana-automatica', 'v1', 'submargen', 'execute'
And request body
When method POST

  Scenario: 2do Caso
Given path 'ms-campana-automatica', 'v1', 'submargen', 'execute'
And request body
When method POST