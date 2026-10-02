package proxy;

import javax.net.ssl.SSLSocket;

import javax.net.ssl.SSLSocketFactory;

public class BiceConnectionTest {

    public static void main(String[] args) {

        String host = "grpc-int-qa.bice.local";

        int port = 443;

        System.out.println("🔌 Conectando a " + host + ":" + port);

        try {

            SSLSocketFactory factory =

                    (SSLSocketFactory) SSLSocketFactory.getDefault();

            try (SSLSocket socket =

                         (SSLSocket) factory.createSocket(host, port)) {

                socket.startHandshake();

                System.out.println(" TLS OK");

                System.out.println(

                        "🔐 Protocolo: " +

                                socket.getSession().getProtocol()

                );

                System.out.println(

                        "Cipher: " +

                                socket.getSession().getCipherSuite()

                );

            }

        } catch (Exception e) {

            System.err.println(" TLS FALLÓ");

            e.printStackTrace();

        }

    }

}
