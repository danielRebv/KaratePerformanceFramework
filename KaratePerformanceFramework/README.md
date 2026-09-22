# 🚀 FWKarate2xx

Framework de automatización de pruebas API y performance construido con Karate, Java 21, Gradle y Gatling.

---

# ✨ Features

- ✅ Automatización API con Karate DSL
- ✅ Integración con Gatling Performance
- ✅ Feeders dinámicos CSV
- ✅ Estrategias sequential/random
- ✅ Flujos dinámicos y correlación de datos
- ✅ Configuración desacoplada de performance
- ✅ Reportes self-contained HTML
- ✅ Arquitectura reusable y escalable

---

# 🧱 Arquitectura

```plaintext
src/test
├── java
│   ├── performance
│   ├── runners
│   └── utils
│
├── resources
│   ├── features
│   ├── feeders
│   ├── environments
│   └── logback
```

---

# ⚙️ Stack Tecnológico

| Tecnología | Uso |
|---|---|
| Java 21 | Base del framework |
| Karate DSL | Automatización API |
| Gatling | Performance testing |
| Gradle | Build management |
| JUnit 5 | Execution |
| Logback | Logging |

---

# ⚡ Performance Testing

El framework permite definir configuraciones dinámicas de performance directamente desde los escenarios Karate.

## Ejemplo

```gherkin
* def performance =
"""
{
  "feeder": "usuarios.csv",
  "strategy": "sequential",

  "injection": {
    "type": "constant",
    "users": 5,
    "duration": 5,
    "rampUp": 0
  }
}
"""
```

---

# 🔄 Feeders

Soporte para:

- Sequential feeders
- Random feeders
- Single row feeders
- Multi-column correlation

## Ejemplo

```gherkin
* def data = Java.type('performance.CsvUtils').row(performance.strategy)

* def userId = data.userId
* def username = data.username
```

---

# 📊 Reporting

- Gatling HTML Reports
- Self-contained HTML reporting
- Métricas parseadas automáticamente

---

# ▶️ Ejecución

## Functional

```bash
gradle apiTest -Ptags=@api
```

## Performance

```bash
gradle performanceTest -Ptags=@performance
```

---

# 🛣️ Roadmap

- [x] Functional API automation
- [x] Gatling integration
- [x] Dynamic CSV feeders
- [x] Sequential/random strategies
- [x] Self-contained performance reports
- [ ] Extent Report integration
- [ ] Azure DevOps Test Plans integration
- [ ] CI/CD pipelines

---

# 👨‍💻 Autor

Daniel Rebolledo
QA Automation Engineer | SDET | Performance Testing