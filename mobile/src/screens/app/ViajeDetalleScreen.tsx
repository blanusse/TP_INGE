import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Alert,
  ActivityIndicator,
  StatusBar,
  Image,
  Modal,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { io, Socket } from "socket.io-client";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import {
  Viaje,
  Mensaje,
  getMessages,
  sendMessage,
  updateLocation,
  getToken,
  getUser,
  BASE_URL,
} from "../../api";
import { colors, typography, radius } from "../../theme";
import { ViajesStackParamList } from "./MainNavigator";

type Props = NativeStackScreenProps<ViajesStackParamList, "ViajeDetalle">;

const STATUS_LABEL: Record<string, string> = {
  in_transit: "En tránsito",
  matched: "Confirmado",
  delivered: "Entregado",
};
const STATUS_COLOR: Record<string, string> = {
  in_transit: colors.brand,
  matched: "#3b82f6",
  delivered: colors.textMuted,
};

function getMapRegion(viaje: Viaje) {
  if (viaje.pickupLat && viaje.dropoffLat) {
    const minLat = Math.min(viaje.pickupLat, viaje.dropoffLat);
    const maxLat = Math.max(viaje.pickupLat, viaje.dropoffLat);
    const minLon = Math.min(viaje.pickupLon!, viaje.dropoffLon!);
    const maxLon = Math.max(viaje.pickupLon!, viaje.dropoffLon!);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.5),
      longitudeDelta: Math.max((maxLon - minLon) * 1.5, 0.5),
    };
  }
  return { latitude: -38.4, longitude: -63.6, latitudeDelta: 22, longitudeDelta: 22 };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export function ViajeDetalleScreen({ route, navigation }: Props) {
  const { viaje } = route.params;
  const myUserId = getUser()?.id ?? "";

  const [tab, setTab] = useState<"detalles" | "chat">("detalles");
  const [sharing, setSharing] = useState(false);
  const [currentLoc, setCurrentLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [messages, setMessages] = useState<Mensaje[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const [sending, setSending] = useState(false);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // ─── Socket.IO chat ───────────────────────────────────────────────────────
  useEffect(() => {
    let disposed = false;

    getMessages(viaje.offerId)
      .then((msgs) => { if (!disposed) setMessages(msgs); })
      .catch(() => {});

    const token = getToken();
    if (!token) return;

    const socket = io(`${BASE_URL}/messages`, { auth: { token } });
    socketRef.current = socket;
    const selfId = myUserId;

    socket.on("connect", () => { socket.emit("join", viaje.offerId); });
    socket.on("new_message", (msg: Mensaje) => {
      if (disposed) return;
      if (msg.sender_id === selfId) return;
      setMessages((prev) => {
        if (prev.some((p) => p.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    return () => {
      disposed = true;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [viaje.offerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Location sharing ─────────────────────────────────────────────────────
  const startSharing = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso requerido", "Necesitamos acceso a tu ubicación para compartirla.");
      return;
    }
    setSharing(true);
    const send = async () => {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setCurrentLoc(coords);
      await updateLocation(viaje.loadId, coords.latitude, coords.longitude).catch(() => {});
    };
    await send();
    intervalRef.current = setInterval(send, 15_000);
  }, [viaje.loadId]);

  const stopSharing = useCallback(() => {
    setSharing(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  // ─── Send message ─────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = msgInput.trim();
    if (!text || sending) return;
    setSending(true);
    setMsgInput("");
    try {
      const msg = await sendMessage(viaje.offerId, text);
      setMessages((prev) => [...prev, msg]);
    } catch {
      Alert.alert("Error", "No se pudo enviar el mensaje.");
      setMsgInput(text);
    } finally {
      setSending(false);
    }
  }, [msgInput, sending, viaje.offerId]);

  const sendImageContent = useCallback(async (dataUri: string) => {
    try {
      const msg = await sendMessage(viaje.offerId, dataUri);
      setMessages((prev) => [...prev, msg]);
    } catch {
      Alert.alert("Error", "No se pudo enviar la imagen.");
    }
  }, [viaje.offerId]);

  const handlePickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso requerido", "Necesitamos acceso a tu cámara.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      await sendImageContent(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  }, [sendImageContent]);

  const statusColor = STATUS_COLOR[viaje.status] ?? colors.textMuted;
  const statusLabel = STATUS_LABEL[viaje.status] ?? viaje.status;
  const hasCoords = !!(viaje.pickupLat && viaje.dropoffLat);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerRoute} numberOfLines={1}>
            {viaje.pickupCity} → {viaje.dropoffCity}
          </Text>
          <Text style={styles.headerEmpresa} numberOfLines={1}>{viaje.empresa}</Text>
        </View>
        <View style={[styles.statusBadge, { borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={getMapRegion(viaje)}
          userInterfaceStyle="dark"
        >
          {hasCoords && (
            <>
              <Marker
                coordinate={{ latitude: viaje.pickupLat!, longitude: viaje.pickupLon! }}
                title="Retiro"
                description={viaje.pickupExact ?? viaje.pickupCity}
                pinColor={colors.brand}
              />
              <Marker
                coordinate={{ latitude: viaje.dropoffLat!, longitude: viaje.dropoffLon! }}
                title="Entrega"
                description={viaje.dropoffExact ?? viaje.dropoffCity}
                pinColor="#ef4444"
              />
              <Polyline
                coordinates={[
                  { latitude: viaje.pickupLat!, longitude: viaje.pickupLon! },
                  { latitude: viaje.dropoffLat!, longitude: viaje.dropoffLon! },
                ]}
                strokeColor={colors.brand}
                strokeWidth={2}
                lineDashPattern={[6, 4]}
              />
            </>
          )}
          {currentLoc && (
            <Marker coordinate={currentLoc} title="Mi ubicación">
              <View style={styles.truckMarker}>
                <Text style={styles.truckEmoji}>🚛</Text>
              </View>
            </Marker>
          )}
        </MapView>

        {/* Share location button overlaid on map bottom */}
        <TouchableOpacity
          style={[styles.shareBtn, sharing && styles.shareBtnActive]}
          onPress={sharing ? stopSharing : startSharing}
          activeOpacity={0.8}
        >
          <Text style={styles.shareBtnText}>
            {sharing ? "● Compartiendo ubicación" : "Compartir ubicación"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === "detalles" && styles.tabActive]}
          onPress={() => setTab("detalles")}
        >
          <Text style={[styles.tabText, tab === "detalles" && styles.tabTextActive]}>
            Detalles
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "chat" && styles.tabActive]}
          onPress={() => setTab("chat")}
        >
          <Text style={[styles.tabText, tab === "chat" && styles.tabTextActive]}>
            Chat
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab content */}
      {tab === "detalles" ? (
        <ScrollView style={styles.details} contentContainerStyle={styles.detailsContent}>
          <InfoRow label="Retiro" value={viaje.pickupExact ?? viaje.pickupCity} icon="📍" />
          <InfoRow label="Entrega" value={viaje.dropoffExact ?? viaje.dropoffCity} icon="🏁" />
          <InfoRow label="Fecha retiro" value={viaje.fechaRetiro} icon="📅" />
          <InfoRow
            label="Precio neto"
            value={"$" + Math.round(viaje.precio).toLocaleString("es-AR")}
            icon="💰"
            highlight
          />
        </ScrollView>
      ) : (
        <KeyboardAvoidingView
          style={styles.chatWrapper}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <Text style={styles.noMessages}>Aún no hay mensajes</Text>
            }
            renderItem={({ item }) => {
              const mine = item.sender_id === myUserId;
              const isImage = item.content.startsWith("data:image/");
              return (
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  {isImage ? (
                    <TouchableOpacity onPress={() => setLightboxUri(item.content)} activeOpacity={0.85}>
                      <Image
                        source={{ uri: item.content }}
                        style={styles.bubbleImage}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                      {item.content}
                    </Text>
                  )}
                  <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                    {formatTime(item.created_at)}
                  </Text>
                </View>
              );
            }}
          />
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.cameraBtn} onPress={handlePickImage} disabled={sending}>
              <Feather name="camera" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              value={msgInput}
              onChangeText={setMsgInput}
              placeholder="Escribí un mensaje..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!msgInput.trim() || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!msgInput.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.sendBtnText}>→</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      <Modal visible={!!lightboxUri} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
        <TouchableOpacity
          style={styles.lightboxOverlay}
          activeOpacity={1}
          onPress={() => setLightboxUri(null)}
        >
          {lightboxUri && (
            <Image source={{ uri: lightboxUri }} style={styles.lightboxImage} resizeMode="contain" />
          )}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.icon}>{icon}</Text>
      <View style={infoStyles.text}>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={[infoStyles.value, highlight && infoStyles.valueHighlight]}>{value}</Text>
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  icon: { fontSize: 20, marginTop: 2 },
  text: { flex: 1 },
  label: { fontSize: typography.size.xs, color: colors.textMuted, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: typography.size.base, color: colors.white, fontWeight: typography.fontWeight.medium },
  valueHighlight: { color: colors.brandLight, fontSize: typography.size.lg, fontWeight: typography.fontWeight.bold },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backText: { color: colors.white, fontSize: 18 },
  headerCenter: { flex: 1 },
  headerRoute: { fontSize: typography.size.base, fontWeight: typography.fontWeight.bold, color: colors.white },
  headerEmpresa: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2 },
  statusBadge: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: { fontSize: typography.size.xs, fontWeight: typography.fontWeight.semibold },
  mapContainer: { height: 240, position: "relative" },
  map: { ...StyleSheet.absoluteFillObject },
  truckMarker: {
    backgroundColor: colors.bg,
    borderRadius: 20,
    padding: 4,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  truckEmoji: { fontSize: 18 },
  shareBtn: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  shareBtnActive: { borderColor: colors.brand, backgroundColor: "rgba(58,128,107,0.3)" },
  shareBtnText: { fontSize: typography.size.sm, color: colors.white, fontWeight: typography.fontWeight.semibold },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.brand },
  tabText: { fontSize: typography.size.sm, color: colors.textMuted, fontWeight: typography.fontWeight.medium },
  tabTextActive: { color: colors.brand, fontWeight: typography.fontWeight.bold },
  details: { flex: 1 },
  detailsContent: { paddingHorizontal: 20, paddingBottom: 32 },
  chatWrapper: { flex: 1 },
  messagesList: { padding: 16, gap: 8, flexGrow: 1 },
  noMessages: { textAlign: "center", color: colors.textMuted, fontSize: typography.size.sm, marginTop: 40 },
  bubble: {
    maxWidth: "78%",
    padding: 10,
    borderRadius: radius.md,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.08)",
    gap: 4,
  },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: colors.brandAlpha,
    borderWidth: 1,
    borderColor: colors.brand,
  },
  bubbleText: { fontSize: typography.size.sm, color: colors.white },
  bubbleTextMine: { color: colors.brandLight },
  bubbleTime: { fontSize: 10, color: colors.textMuted },
  bubbleTimeMine: { color: colors.brand, textAlign: "right" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.white,
    fontSize: typography.size.sm,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "rgba(255,255,255,0.1)" },
  sendBtnText: { color: colors.white, fontSize: 18, fontWeight: typography.fontWeight.bold },
  cameraBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleImage: {
    width: 220,
    height: 165,
    borderRadius: radius.sm,
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxImage: {
    width: "95%",
    height: "80%",
  },
});
