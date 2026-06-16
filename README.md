para generar el .json que tiene las prendas ejecutar en el contenedor, se hara cada vez que se incorpore o elimine una prenda
hay que recompilar y subir de nuevo

 npm run generate:json

## Despliegue PRE

El workflow `Frontend - Build and Push` publica la imagen PRE en ECR con tag `sha-${{ github.sha }}` solo cuando se lanza manualmente con `workflow_dispatch` desde la rama `pre`. Este repositorio no ejecuta Helm, kubectl ni Terraform.

Tras publicar la imagen, el workflow genera un token de instalacion con la GitHub App `gesplan-infra-apps-dispatcher` y envia `repository_dispatch` a `gesplan-idi/infra-apps` con `environment=pre`, `component=frontend` y `source_branch=pre`.

PRO no esta habilitado. Si se selecciona `pro` en el dispatch manual, el workflow falla con `PRO deployment is not enabled yet`.

Configuracion necesaria en este repo:

- Variable `INFRA_APPS_DISPATCH_APP_ID`
- Secret `INFRA_APPS_DISPATCH_PRIVATE_KEY`

`infra-apps` valida el evento y ejecuta el despliegue real en PRE. El dry-run queda disponible en el workflow manual de `infra-apps`.

Modelo de ramas:

- `feature/*` abre pull request contra `pre`.
- `pre` se usa para publicar imagenes PRE mediante `workflow_dispatch`.
- `pre` se promociona a `main` mediante pull request.
- `main` queda como futura base de PRO.
