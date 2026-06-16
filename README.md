para generar el .json que tiene las prendas ejecutar en el contenedor, se hara cada vez que se incorpore o elimine una prenda
hay que recompilar y subir de nuevo

 npm run generate:json

## Despliegue PRE

El workflow `Frontend - Build and Push` publica la imagen PRE en ECR con tag `sha-${{ github.sha }}`. Este repositorio no ejecuta Helm, kubectl ni Terraform.

Tras publicar la imagen, el workflow genera un token de instalacion con la GitHub App `gesplan-infra-apps-dispatcher` y envia `repository_dispatch` a `gesplan-idi/infra-apps` con `component=frontend`.

Configuracion necesaria en este repo:

- Variable `INFRA_APPS_DISPATCH_APP_ID`
- Secret `INFRA_APPS_DISPATCH_PRIVATE_KEY`

`infra-apps` valida el evento y ejecuta el flujo PRE en `dry_run=true` por defecto para la primera fase.
