package proxy;
import io.netty.bootstrap.ServerBootstrap;
import io.netty.channel.Channel;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInitializer;
import io.netty.channel.ChannelPipeline;
import io.netty.channel.EventLoopGroup;
import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import io.netty.handler.codec.http2.Http2FrameCodecBuilder;
import io.netty.handler.codec.http2.Http2HeadersFrame;
import io.netty.handler.codec.http2.Http2MultiplexHandler;
import io.netty.handler.codec.http2.Http2StreamFrame;
public class GrpcPathProxy {
    private static final int PORT = 50051;
    public static void main(String[] args) throws Exception {
        EventLoopGroup bossGroup = new NioEventLoopGroup(1);
        EventLoopGroup workerGroup = new NioEventLoopGroup();
        try {
            ServerBootstrap bootstrap = new ServerBootstrap();
            bootstrap
                    .group(bossGroup, workerGroup)
                    .channel(NioServerSocketChannel.class)
                    .childHandler(new ChannelInitializer<SocketChannel>() {
                        @Override
                        protected void initChannel(SocketChannel channel) {
                            ChannelPipeline pipeline = channel.pipeline();
                            // HTTP/2 plaintext (h2c)
                            pipeline.addLast(
                                    Http2FrameCodecBuilder
                                            .forServer()
                                            .build()
                            );
                            // Cada request HTTP/2 tiene su propio stream.
                            pipeline.addLast(
                                    new Http2MultiplexHandler(
                                            new ChannelInitializer<Channel>() {
                                                @Override
                                                protected void initChannel(Channel streamChannel) {
                                                    streamChannel
                                                            .pipeline()
                                                            .addLast(
                                                                    new Http2PathLogger()
                                                            );
                                                }
                                            }
                                    )
                            );
                        }
                    });
            Channel serverChannel = bootstrap
                    .bind(PORT)
                    .sync()
                    .channel();
            System.out.println();
            System.out.println("==========================================");
            System.out.println(" GrpcPathProxy");
            System.out.println(" Escuchando en localhost:" + PORT);
            System.out.println(" Esperando request gRPC de k6...");
            System.out.println("==========================================");
            System.out.println();
            serverChannel
                    .closeFuture()
                    .sync();
        } finally {
            bossGroup.shutdownGracefully();
            workerGroup.shutdownGracefully();
        }
    }
    /**
     * Por ahora NO funciona como proxy.
     *
     * Este primer experimento solamente captura los headers
     * HTTP/2 enviados por k6 para descubrir el :path real
     * de la llamada gRPC.
     */
    private static class Http2PathLogger
            extends SimpleChannelInboundHandler<Http2StreamFrame> {
        @Override
        protected void channelRead0(
                ChannelHandlerContext ctx,
                Http2StreamFrame frame) {
            if (!(frame instanceof Http2HeadersFrame headersFrame)) {
                return;
            }
            System.out.println();
            System.out.println("REQUEST HTTP/2 DETECTADO");
            System.out.println("------------------------------------------");
            headersFrame.headers().forEach(header ->
                    System.out.println(
                            header.getKey() + ": " + header.getValue()
                    )
            );
            System.out.println("------------------------------------------");
            System.out.println(
                    " PATH REAL: " +
                            headersFrame.headers().path()
            );
            System.out.println("------------------------------------------");
            System.out.println();
            /*
             * Cerramos intencionalmente.
             *
             * Todavía NO estamos respondiendo gRPC.
             * Solo queremos observar qué manda k6.
             */
            ctx.close();
        }
        @Override
        public void exceptionCaught(
                ChannelHandlerContext ctx,
                Throwable cause) {
            System.err.println(
                    " Error capturando request: " +
                            cause.getMessage()
            );
            ctx.close();
        }
    }
}