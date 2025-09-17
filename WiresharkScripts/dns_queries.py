import dns.resolver
import time

# Lista de consultas DNS (dominio, tipo de registro)
consultas = [
    ("youtube.com", "A"),
    ("facebook.com", "A"),
    ("vodafone.es", "A"),
    ("ox.ac.uk", "A"),
    ("orange.fr", "A"),
    ("isu.ru", "A"),
    ("wikipedia.org", "A"),
    ("wsu.ac.za", "A"),
    ("ufrj.br"  , "A"),
    ("microsoft.com", "SOA"),
    ("amazon.com", "PTR"),
    ("bbc.co.uk", "A"),
    ("mit.edu", "A"),
    ("cloudflare.com", "PTR"),
    ("twitter.com", "AAAA"),
    ("linkedin.com", "MX"),
    ("apple.com", "A"),
    ("yahoo.com", "AAAA")
]

def ejecutar_consulta(dominio, tipo):
    try:
        # Realizar la consulta DNS
        respuesta = dns.resolver.resolve(dominio, tipo)
        print(f"Consulta: {dominio} ({tipo})")
        for dato in respuesta:
            print(f"  Respuesta: {dato}")
    except dns.resolver.NoAnswer:
        print(f"Consulta: {dominio} ({tipo}) - No hay respuesta")
    except dns.resolver.NXDOMAIN:
        print(f"Consulta: {dominio} ({tipo}) - Dominio no encontrado")
    except dns.resolver.Timeout:
        print(f"Consulta: {dominio} ({tipo}) - Tiempo de espera agotado")
    except Exception as e:
        print(f"Consulta: {dominio} ({tipo}) - Error: {e}")

# Realizar consultas repetidas
numero_repeticiones = 200  
intervalo = 5

for _ in range(numero_repeticiones):
    for dominio, tipo in consultas:
        ejecutar_consulta(dominio, tipo)
        time.sleep(intervalo)  
    print("-" * 40)  
