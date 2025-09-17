from scapy.all import send, IP, TCP

for i in range(10000):
    pkt = IP(dst="192.168.1.1") / TCP(dport=80)
    send(pkt, verbose=False)
