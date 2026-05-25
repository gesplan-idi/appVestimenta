# Reglas proyecto frontend Vestimenta

## Contexto

- Aplicación: Vestimenta frontend.
- Framework: Angular.
- Entorno objetivo: AWS EKS PRE.
- Namespace Kubernetes: `gesplan-pre-vestimenta`.
- Imagen ECR PRE: `674624358677.dkr.ecr.eu-west-1.amazonaws.com/gesplan-pre/vestimenta-frontend`.
- Puerto interno esperado: `80`.
- Backend interno: `vestimenta-backend:8080`.
- El frontend debe llamar al backend mediante rutas relativas `/api`, `/prendas` y `/pages` cuando aplique.
- Vestimenta es aplicación interna y quedará protegida por OAuth2 Proxy/Azure AD en el Ingress final.

## Reglas

- No añadir secretos reales.
- No tocar backend.
- No crear PRO.
- No crear Ingress definitivo todavía.
- No modificar OAuth2 Proxy.
- No usar credenciales AWS estáticas.
- No cambiar lógica funcional salvo necesidad justificada.
- Generar cambios pequeños y revisables.