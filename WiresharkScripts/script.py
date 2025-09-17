import os
import sys
import logging
import time
from datetime import datetime
import pytz
import threading

# Asegúrese de que existan directorios
log_dir = "C:\WiresharkScripts\logs"
status_dir = "C:\WiresharkScripts"
cache_dir = "C:\WiresharkScripts\scapy_cache"

for directory in [log_dir, status_dir, cache_dir]:
    if not os.path.exists(directory):
        os.makedirs(directory)

# Configuración inicial de Scapy
os.environ['SCAPY_DISABLE_SERVICES'] = '1'  # Deshabilita servicios que causan el error
os.environ['SCAPY_CACHE_DIR'] = cache_dir

# Importar después de configurar las variables de entorno
from scapy.all import *
from scapy.layers.dns import DNS, DNSQR, DNSRR
import mysql.connector
import geoip2.database

class PacketCapture:
    def __init__(self, user_id):
        self.user_id = user_id
        self.setup_logging()
        
        # Configuración de base de datos
        self.db_config = {
            'host': 'localhost',
            'port': 3306,
            'user': 'root',
            'password': 'root',
            'database': 'db_paquetes'
        }
        
        # Inicializar valores
        self.packet_count = 0
        self.start_time = time.time()
        self.dns_queries = {}
        self.last_packet_time = 0
        self.capture_stopped = False  # Nueva bandera para controlar el estado
        
        # Cargar base de datos GeoIP
        try:
            self.geoip_reader = geoip2.database.Reader('C:\\WiresharkScripts\\GeoLite2-Country.mmdb')
            self.logger.info("Base de datos GeoIP cargada correctamente")
        except Exception as e:
            self.logger.error(f"Error cargando base de datos GeoIP: {e}")
            self.geoip_reader = None

    def setup_logging(self):
        """Configurar sistema de logging"""
        log_file = os.path.join(log_dir, f"capture_user_{self.user_id}.log")
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(f"PacketCapture-{self.user_id}")

    def get_dns_info(self, packet):
        """Extraer información DNS de un paquete"""
        dns_info = {'tiporegistro': '', 'dnstiempo': 0, 'tipomensaje': '', 'queryname': '', 'respname': ''}
        if packet.haslayer(DNS):
            dns = packet[DNS]
            if dns.qr == 0:  # consulta
                dns_info['tipomensaje'] = 'consulta'
                if dns.haslayer(DNSQR):
                    qname = dns[DNSQR].qname.decode('utf-8')
                    dns_info['queryname'] = qname
                    dns_info['tiporegistro'] = self.get_dns_type(dns[DNSQR].qtype)
                    self.dns_queries[f"{qname}-{dns.id}"] = time.time()
            elif dns.qr == 1:  # respuesta
                dns_info['tipomensaje'] = 'respuesta'
                if dns.haslayer(DNSRR):
                    respname = dns[DNSRR].rrname.decode('utf-8')
                    dns_info['respname'] = respname
                    dns_info['tiporegistro'] = self.get_dns_type(dns[DNSRR].type)
                    query_key = f"{respname}-{dns.id}"
                    if query_key in self.dns_queries:
                        dns_info['dnstiempo'] = time.time() - self.dns_queries[query_key]
                        del self.dns_queries[query_key]
        return dns_info

    def get_dns_type(self, qtype):
        """Convertir código de tipo DNS a nombre legible"""
        dns_types = {
            1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 12: 'PTR',
            15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV',
            44: 'SSHFP', 65: 'HTTPS'
        }
        return dns_types.get(qtype, f"Tipo-{qtype}")

    def get_country(self, ip):
        """Obtener país a partir de IP usando GeoIP"""
        if not self.geoip_reader:
            return ""
            
        try:
            response = self.geoip_reader.country(ip)
            return response.country.name
        except:
            return ""

    def process_packet(self, packet):
        try:
            # Limitar tasa de captura para evitar sobrecarga
            current_time = time.time()
            if current_time - self.last_packet_time < 0.05:
                return
            self.last_packet_time = current_time
            
            self.packet_count += 1
            
            # Formatear tiempo de llegada
            arrival_time = current_time
            try:
                marruecos_tz = pytz.timezone('Europa/Madrid')
                arrival_dt = datetime.fromtimestamp(arrival_time, marruecos_tz)
                formatted_arrival = arrival_dt.strftime("%b %d, %Y %H:%M:%S.%f")
            except:
                formatted_arrival = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')
            
            # Datos básicos del paquete
            data = {
                'numero': self.packet_count,
                'tiempo': arrival_time - self.start_time,
                'arrivaltime': formatted_arrival,
                'iporigen': '', 
                'ipdestino': '', 
                'protocolo': '',
                'origenpuerto': 0, 
                'destinopuerto': 0,
                'geoippais': '', 
                'tiporegistro': '', 
                'dnstiempo': 0.0, 
                'tipomensaje': '',
                'queryname': '', 
                'respname': '',
                'usuario_id': self.user_id
            }

            if IP in packet:
                data['iporigen'] = packet[IP].src
                data['ipdestino'] = packet[IP].dst

                if TCP in packet or UDP in packet:
                    transport = packet[TCP] if TCP in packet else packet[UDP]
                    data['origenpuerto'] = transport.sport
                    data['destinopuerto'] = transport.dport

                    if data['origenpuerto'] == 53 or data['destinopuerto'] == 53:
                        data['protocolo'] = "DNS"
                        dns_info = self.get_dns_info(packet)
                        data.update(dns_info)
                    elif data['origenpuerto'] == 80 or data['destinopuerto'] == 80:
                        data['protocolo'] = "HTTP"
                    elif data['origenpuerto'] == 443 or data['destinopuerto'] == 443:
                        data['protocolo'] = "HTTPS"
                    else:
                        data['protocolo'] = 'TCP' if TCP in packet else 'UDP'
                elif ICMP in packet:
                    data['protocolo'] = 'ICMP'

                data['geoippais'] = self.get_country(data['ipdestino'])

            # Insertar en base de datos
            self.insert_packet(data)
            
            # Verificar cada 100 paquetes si debemos detener la captura
            if self.packet_count % 100 == 0:
                if self.check_stop_condition():
                    raise KeyboardInterrupt("Señal de detención detectada")
            
        except Exception as e:
            self.logger.error(f"Error procesando paquete: {e}")

    def insert_packet(self, data):
        try:
            conn = mysql.connector.connect(**self.db_config)
            cursor = conn.cursor()
            
            # Consulta dinámica basada en las claves del diccionario data
            fields = ", ".join(data.keys())
            placeholders = ", ".join(["%s"] * len(data))
            
            query = f"INSERT INTO datos_paquetes ({fields}) VALUES ({placeholders})"
            
            cursor.execute(query, tuple(data.values()))
            conn.commit()
            
        except mysql.connector.Error as e:
            self.logger.error(f"Error en base de datos: {e}")
        finally:
            if 'conn' in locals() and conn.is_connected():
                cursor.close()
                conn.close()

    def check_stop_condition(self):
        """Verifica si existe señal para detener la captura"""
        stop_file = f"C:\WiresharkScripts\stop_{self.user_id}.txt"
        if os.path.exists(stop_file):
            try:
                # Eliminar archivo de señal de detención
                os.remove(stop_file)
                
                # IMPORTANTE: Eliminar también el archivo de estado inmediatamente
                status_file = f"C:\WiresharkScripts\status_user_{self.user_id}.txt"
                if os.path.exists(status_file):
                    os.remove(status_file)
                    self.logger.info("Archivo de estado eliminado")
                
                self.capture_stopped = True
                self.logger.info("Señal de detención detectada. Finalizando captura.")
                return True
            except Exception as e:
                self.logger.error(f"Error eliminando archivos de control: {e}")
        return False

    def cleanup(self):
        """Limpia archivos temporales y recursos"""
        try:
            # Solo intentar eliminar el archivo de estado si no se eliminó ya
            if not self.capture_stopped:
                status_file = f"C:\WiresharkScripts\status_user_{self.user_id}.txt"
                if os.path.exists(status_file):
                    os.remove(status_file)
                    self.logger.info("Archivo de estado eliminado en cleanup")
                
            # Cerrar el lector de GeoIP si existe
            if self.geoip_reader:
                self.geoip_reader.close()
                
            # Registrar fin de captura en la base de datos
            try:
                conn = mysql.connector.connect(**self.db_config)
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO datos_paquetes (usuario_id, tipomensaje, numero) VALUES (%s, 'fin_captura', %s)",
                    (self.user_id, self.packet_count + 1)
                )
                conn.commit()
            except Exception as e:
                self.logger.error(f"Error registrando fin de captura: {e}")
            finally:
                if 'conn' in locals() and conn.is_connected():
                    cursor.close()
                    conn.close()
                    
        except Exception as e:
            self.logger.error(f"Error en limpieza: {e}")

    def start_capture(self, interface="Wi-Fi"):
        try:
            self.logger.info(f"Iniciando captura para usuario {self.user_id}")
            
            # Borrar caché DNS
            try:
                os.system("ipconfig /flushdns")
                self.logger.info("Caché DNS borrada correctamente")
            except Exception as e:
                self.logger.error(f"Error borrando caché DNS: {e}")
            
            # Crear archivo de estado
            status_file = f"C:\WiresharkScripts\status_user_{self.user_id}.txt"
            with open(status_file, "w") as f:
                f.write(str(time.time()))
            
            # Configurar thread para verificar señal de detención periódicamente
            stop_event = threading.Event()
            
            def check_stop_signal():
                while not stop_event.is_set():
                    if self.check_stop_condition():
                        stop_event.set()
                        break
                    time.sleep(1)
            
            stop_thread = threading.Thread(target=check_stop_signal)
            stop_thread.daemon = True
            stop_thread.start()
            
            # Iniciar captura
            self.logger.info(f"Captura iniciada en interfaz {interface}")
            
            try:
                sniff(
                    iface=interface,
                    prn=self.process_packet,
                    store=False,
                    stop_filter=lambda p: stop_event.is_set()
                )
            except KeyboardInterrupt:
                self.logger.info("Captura interrumpida")
            except Exception as e:
                self.logger.error(f"Error en sniff: {e}")
            
        except Exception as e:
            self.logger.error(f"Error en captura: {e}")
            raise
        finally:
            self.cleanup()
            self.logger.info(f"Captura finalizada. Paquetes procesados: {self.packet_count}")

if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            print("Uso: python script.py <user_id> [interface]")
            sys.exit(1)
            
        user_id = int(sys.argv[1])
        interface = sys.argv[2] if len(sys.argv) > 2 else "Wi-Fi"
        
        capture = PacketCapture(user_id)
        capture.start_capture(interface)
        
    except Exception as e:
        print(f"Error: {e}")
        logging.error(f"Error fatal en script principal: {e}")
        sys.exit(1)