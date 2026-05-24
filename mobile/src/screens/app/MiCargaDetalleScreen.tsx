import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Clipboard,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Image,
} from "react-native";
import { io, Socket } from "socket.io-client";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  getDeliveryCode, getOffersForLoad, updateOffer, updateLoad, deleteLoad,
  getMessages, sendMessage, getToken, getUser,
  Oferta, Mensaje, BASE_URL,
} from "../../api";
import { colors, typography, radius } from "../../theme";
import { MisCargasStackParamList } from "./MainNavigator";

type Props = NativeStackScreenProps<MisCargasStackParamList, "MiCargaDetalle">;

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  available:  { label: "Publicada",   color: colors.textMuted },
  matched:    { label: "Asignada",    color: "#3b82f6" },
  in_transit: { label: "En tránsito", color: colors.brand },
  delivered:  { label: "Entregada",   color: "#22c55e" },
  cancelled:  { label: "Cancelada",   color: "#ef4444" },
};

const OFFER_STATUS_LABEL: Record<string, string> = {
  pending:   "Pendiente",
  countered: "Contraofertada",
  accepted:  "Aceptada",
  rejected:  "Rechazada",
  withdrawn: "Retirada",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Stars({ rating }: { rating: number | null }) {
  if (rating == null) return <Text style={styles.noRating}>Sin calificaciones</Text>;
  return <Text style={styles.rating}>{"★".repeat(Math.round(rating))} {rating.toFixed(1)}</Text>;
}

function OfertaCard({
  oferta,
  onAccept,
  onReject,
  onCounter,
  loading,
}: {
  oferta: Oferta;
  onAccept: () => void;
  onReject: () => void;
  onCounter: () => void;
  loading: boolean;
}) {
  const actionable = oferta.status === "pending" || oferta.status === "countered";

  return (
    <View style={styles.ofertaCard}>
      <View style={styles.ofertaHeader}>
        <View style={styles.ofertaDriver}>
          <Text style={styles.ofertaName}>{oferta.driver.name}</Text>
          <Stars rating={oferta.avg_rating} />
        </View>
        <View style={styles.ofertaPriceCol}>
          <Text style={styles.ofertaPrice}>
            ${Math.round(oferta.price).toLocaleString("es-AR")}
          </Text>
          {oferta.counter_price != null && (
            <Text style={styles.ofertaCounter}>
              Contraofer.: ${Math.round(oferta.counter_price).toLocaleString("es-AR")}
            </Text>
          )}
        </View>
      </View>

      {oferta.note ? (
        <Text style={styles.ofertaNote}>{oferta.note}</Text>
      ) : null}

      {!actionable && (
        <View style={styles.ofertaStatusRow}>
          <Text style={styles.ofertaStatusText}>{OFFER_STATUS_LABEL[oferta.status] ?? oferta.status}</Text>
        </View>
      )}

      {actionable && (
        <View style={styles.ofertaActions}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : (
            <>
              <TouchableOpacity style={styles.btnAccept} onPress={onAccept} activeOpacity={0.75}>
                <Text style={styles.btnAcceptText}>Aceptar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnCounter} onPress={onCounter} activeOpacity={0.75}>
                <Text style={styles.btnCounterText}>Contraofertar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnReject} onPress={onReject} activeOpacity={0.75}>
                <Text style={styles.btnRejectText}>Rechazar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

export function MiCargaDetalleScreen({ route, navigation }: Props) {
  const { carga } = route.params;
  const status = STATUS_CONFIG[carga.status] ?? { label: carga.status, color: colors.textMuted };
  const needsCode = carga.status === "matched" || carga.status === "in_transit";
  const hasOffers = carga.status === "available" && carga.offer_count > 0;
  const canEdit = carga.status === "available";
  const hasChat = carga.status === "in_transit" && !!carga.accepted_offer;
  const offerId = carga.accepted_offer?.offerId ?? null;
  const myUserId = getUser()?.id ?? "";

  // Delivery code
  const [deliveryCode, setDeliveryCode] = useState<string | null>(null);
  const [codeUsed, setCodeUsed] = useState(false);
  const [codeLoading, setCodeLoading] = useState(needsCode);

  // Offers
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [offersLoading, setOffersLoading] = useState(hasOffers);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Counter-offer modal
  const [counterModal, setCounterModal] = useState<Oferta | null>(null);
  const [counterPrice, setCounterPrice] = useState("");
  const [counterSending, setCounterSending] = useState(false);

  // Chat
  const [activeTab, setActiveTab] = useState<"detalles" | "mensajes">("detalles");
  const [messages, setMessages] = useState<Mensaje[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!hasChat || !offerId) return;
    let disposed = false;

    getMessages(offerId)
      .then((msgs) => { if (!disposed) setMessages(msgs); })
      .catch(() => {});

    const token = getToken();
    if (!token) return;

    const socket = io(`${BASE_URL}/messages`, { auth: { token } });
    socketRef.current = socket;
    const selfId = myUserId;

    socket.on("connect", () => { socket.emit("join", offerId); });
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
  }, [hasChat, offerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSendMsg = useCallback(async () => {
    const text = msgInput.trim();
    if (!text || msgSending || !offerId) return;
    setMsgSending(true);
    setMsgInput("");
    try {
      const msg = await sendMessage(offerId, text);
      setMessages((prev) => [...prev, msg]);
    } catch {
      Alert.alert("Error", "No se pudo enviar el mensaje.");
      setMsgInput(text);
    } finally {
      setMsgSending(false);
    }
  }, [msgInput, msgSending, offerId]);

  const sendImageContent = useCallback(async (dataUri: string) => {
    if (!offerId) return;
    try {
      const msg = await sendMessage(offerId, dataUri);
      setMessages((prev) => [...prev, msg]);
    } catch {
      Alert.alert("Error", "No se pudo enviar la imagen.");
    }
  }, [offerId]);

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

  // Edit modal
  const [editModal, setEditModal] = useState(false);
  const [editFields, setEditFields] = useState({
    cargo_type: carga.cargo_type ?? "",
    truck_type_required: carga.truck_type_required ?? "",
    weight_kg: carga.weight_kg != null ? String(carga.weight_kg) : "",
    price_base: carga.price_base != null ? String(Math.round(carga.price_base)) : "",
    description: carga.description ?? "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!needsCode) return;
    getDeliveryCode(carga.id).then((res) => {
      if (res) { setDeliveryCode(res.delivery_code); setCodeUsed(res.delivery_code_used); }
      setCodeLoading(false);
    });
  }, [carga.id, needsCode]);

  const loadOfertas = useCallback(async () => {
    if (!hasOffers) return;
    try {
      const data = await getOffersForLoad(carga.id);
      setOfertas(data);
    } catch {
      Alert.alert("Error", "No se pudieron cargar las ofertas.");
    } finally {
      setOffersLoading(false);
    }
  }, [carga.id, hasOffers]);

  useEffect(() => { loadOfertas(); }, [loadOfertas]);

  const handleAction = async (oferta: Oferta, action: "accept" | "reject") => {
    const labels = { accept: "aceptar", reject: "rechazar" };
    Alert.alert(
      action === "accept" ? "Aceptar oferta" : "Rechazar oferta",
      `¿Querés ${labels[action]} la oferta de ${oferta.driver.name} por $${Math.round(oferta.price).toLocaleString("es-AR")}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: action === "accept" ? "Aceptar" : "Rechazar",
          style: action === "reject" ? "destructive" : "default",
          onPress: async () => {
            setActionLoading(oferta.id);
            try {
              await updateOffer(oferta.id, action);
              await loadOfertas();
            } catch (e: unknown) {
              Alert.alert("Error", e instanceof Error ? e.message : "Ocurrió un error.");
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleCounter = async () => {
    if (!counterModal) return;
    const price = parseFloat(counterPrice.replace(/\./g, "").replace(",", "."));
    if (isNaN(price) || price <= 0) {
      Alert.alert("Precio inválido", "Ingresá un monto válido.");
      return;
    }
    setCounterSending(true);
    try {
      await updateOffer(counterModal.id, "counter", price);
      setCounterModal(null);
      setCounterPrice("");
      await loadOfertas();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Ocurrió un error.");
    } finally {
      setCounterSending(false);
    }
  };

  const handleSaveEdit = async () => {
    const weight = parseFloat(editFields.weight_kg);
    const price = parseFloat(editFields.price_base);
    if (editFields.weight_kg && (isNaN(weight) || weight <= 0)) {
      Alert.alert("Error", "El peso debe ser un número mayor a 0.");
      return;
    }
    if (editFields.price_base && (isNaN(price) || price <= 0)) {
      Alert.alert("Error", "El precio debe ser un número mayor a 0.");
      return;
    }
    setEditSaving(true);
    try {
      await updateLoad(carga.id, {
        cargo_type: editFields.cargo_type || undefined,
        truck_type_required: editFields.truck_type_required || undefined,
        weight_kg: editFields.weight_kg ? weight : undefined,
        price_base: editFields.price_base ? price : undefined,
        description: editFields.description || undefined,
      });
      setEditModal(false);
      Alert.alert("Listo", "La carga fue actualizada.");
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Ocurrió un error.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Eliminar carga",
      "¿Estás seguro? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteLoad(carga.id);
              navigation.goBack();
            } catch (e: unknown) {
              Alert.alert("Error", e instanceof Error ? e.message : "Ocurrió un error.");
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const copyCode = () => {
    if (!deliveryCode) return;
    Clipboard.setString(deliveryCode);
    Alert.alert("Copiado", "El código de entrega fue copiado al portapapeles.");
  };

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          {canEdit && (
            <TouchableOpacity onPress={() => setEditModal(true)} hitSlop={8}>
              <Text style={styles.editBtn}>Editar</Text>
            </TouchableOpacity>
          )}
          <View style={[styles.statusBadge, { borderColor: status.color }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
      </View>

      {hasChat && (
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "detalles" && styles.tabActive]}
            onPress={() => setActiveTab("detalles")}
          >
            <Text style={[styles.tabText, activeTab === "detalles" && styles.tabTextActive]}>Detalles</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "mensajes" && styles.tabActive]}
            onPress={() => setActiveTab("mensajes")}
          >
            <Text style={[styles.tabText, activeTab === "mensajes" && styles.tabTextActive]}>Mensajes</Text>
          </TouchableOpacity>
        </View>
      )}

      {hasChat && activeTab === "mensajes" ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={<Text style={styles.noMessages}>Aún no hay mensajes</Text>}
            renderItem={({ item }) => {
              const mine = item.sender_id === myUserId;
              const isImage = item.content.startsWith("data:image/");
              return (
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  {isImage ? (
                    <Image
                      source={{ uri: item.content }}
                      style={styles.bubbleImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.content}</Text>
                  )}
                  <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                    {new Date(item.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              );
            }}
          />
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.cameraBtn} onPress={handlePickImage} disabled={msgSending}>
              <Feather name="camera" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TextInput
              style={styles.msgInput}
              value={msgInput}
              onChangeText={setMsgInput}
              placeholder="Escribí un mensaje..."
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={handleSendMsg}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!msgInput.trim() || msgSending) && styles.sendBtnDisabled]}
              onPress={handleSendMsg}
              disabled={!msgInput.trim() || msgSending}
            >
              {msgSending
                ? <ActivityIndicator size="small" color={colors.bg} />
                : <Text style={styles.sendBtnText}>Enviar</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Ruta */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={styles.routeCol}>
              <Text style={styles.routeLabel}>Origen</Text>
              <Text style={styles.routeCity}>{carga.pickup_city}</Text>
              {carga.pickup_exact ? <Text style={styles.routeExact}>{carga.pickup_exact}</Text> : null}
            </View>
            <Text style={styles.routeArrow}>→</Text>
            <View style={[styles.routeCol, styles.routeColRight]}>
              <Text style={[styles.routeLabel, { textAlign: "right" }]}>Destino</Text>
              <Text style={[styles.routeCity, { textAlign: "right" }]}>{carga.dropoff_city}</Text>
              {carga.dropoff_exact ? <Text style={[styles.routeExact, { textAlign: "right" }]}>{carga.dropoff_exact}</Text> : null}
            </View>
          </View>
        </View>

        {/* Detalles */}
        <Section title="Detalles de la carga">
          {carga.cargo_type && <Row label="Tipo de carga" value={carga.cargo_type} />}
          {carga.truck_type_required && <Row label="Camión requerido" value={carga.truck_type_required} />}
          {carga.weight_kg != null && (
            <Row label="Peso" value={carga.weight_kg >= 1000 ? `${(carga.weight_kg / 1000).toFixed(1)} t` : `${carga.weight_kg} kg`} />
          )}
          {carga.distance_km != null && <Row label="Distancia" value={`${Math.round(carga.distance_km)} km`} />}
          {carga.ready_at && <Row label="Fecha de retiro" value={formatDate(carga.ready_at) ?? ""} />}
          {carga.description ? <Row label="Descripción" value={carga.description} /> : null}
        </Section>

        {/* Precio */}
        <Section title="Precio">
          {carga.price_base != null && (
            <Row label="Precio base" value={`$${Math.round(carga.price_base).toLocaleString("es-AR")}`} />
          )}
          {carga.accepted_offer && (
            <Row label="Precio acordado" value={`$${Math.round(carga.accepted_offer.precio).toLocaleString("es-AR")}`} />
          )}
        </Section>

        {/* Ofertas */}
        {hasOffers && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Ofertas recibidas ({carga.offer_count})
            </Text>
            {offersLoading ? (
              <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
            ) : (
              <View style={styles.ofertasList}>
                {ofertas.map((oferta) => (
                  <OfertaCard
                    key={oferta.id}
                    oferta={oferta}
                    loading={actionLoading === oferta.id}
                    onAccept={() => handleAction(oferta, "accept")}
                    onReject={() => handleAction(oferta, "reject")}
                    onCounter={() => {
                      setCounterModal(oferta);
                      setCounterPrice(Math.round(oferta.price).toString());
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Transportista asignado */}
        {carga.accepted_offer && (
          <Section title="Transportista asignado">
            <Row label="Nombre" value={carga.accepted_offer.driverName} />
          </Section>
        )}

        {/* Código de entrega */}
        {needsCode && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Código de entrega</Text>
            <View style={styles.sectionBody}>
              {codeLoading ? (
                <View style={styles.codeLoadingBox}><ActivityIndicator size="small" color={colors.brand} /></View>
              ) : deliveryCode ? (
                <TouchableOpacity style={styles.codeBox} onPress={copyCode} activeOpacity={0.7}>
                  <Text style={styles.codeText}>{deliveryCode}</Text>
                  <Text style={styles.codeCopy}>Tocar para copiar</Text>
                  {codeUsed && (
                    <View style={styles.codeUsedBadge}>
                      <Text style={styles.codeUsedText}>Usado</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.codeLoadingBox}>
                  <Text style={styles.rowValue}>No disponible aún</Text>
                </View>
              )}
            </View>
          </View>
        )}
        {/* Eliminar */}
        {canEdit && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDelete}
            disabled={deleting}
            activeOpacity={0.75}
          >
            {deleting
              ? <ActivityIndicator size="small" color="#ef4444" />
              : <Text style={styles.deleteBtnText}>Eliminar carga</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>
      )}

      {/* Modal de edición */}
      <Modal visible={editModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <View style={styles.editModalBox}>
            <Text style={styles.modalTitle}>Editar carga</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.editForm}>
              <Text style={styles.fieldLabel}>Tipo de carga</Text>
              <TextInput
                style={styles.modalInput}
                value={editFields.cargo_type}
                onChangeText={(v) => setEditFields((f) => ({ ...f, cargo_type: v }))}
                placeholder="Ej: Granos, Electrodomésticos"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.fieldLabel}>Tipo de camión requerido</Text>
              <TextInput
                style={styles.modalInput}
                value={editFields.truck_type_required}
                onChangeText={(v) => setEditFields((f) => ({ ...f, truck_type_required: v }))}
                placeholder="Ej: Semirremolque, Furgón"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.fieldLabel}>Peso (kg)</Text>
              <TextInput
                style={styles.modalInput}
                value={editFields.weight_kg}
                onChangeText={(v) => setEditFields((f) => ({ ...f, weight_kg: v }))}
                keyboardType="numeric"
                placeholder="Ej: 5000"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.fieldLabel}>Precio base ($)</Text>
              <TextInput
                style={styles.modalInput}
                value={editFields.price_base}
                onChangeText={(v) => setEditFields((f) => ({ ...f, price_base: v }))}
                keyboardType="numeric"
                placeholder="Ej: 150000"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.fieldLabel}>Descripción</Text>
              <TextInput
                style={[styles.modalInput, styles.modalInputMulti]}
                value={editFields.description}
                onChangeText={(v) => setEditFields((f) => ({ ...f, description: v }))}
                placeholder="Información adicional..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setEditModal(false)}
                disabled={editSaving}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleSaveEdit} disabled={editSaving}>
                {editSaving
                  ? <ActivityIndicator size="small" color={colors.bg} />
                  : <Text style={styles.modalConfirmText}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal de contraoferta */}
      <Modal visible={counterModal !== null} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Contraofertar</Text>
            {counterModal && (
              <Text style={styles.modalSubtitle}>
                Oferta de {counterModal.driver.name}: ${Math.round(counterModal.price).toLocaleString("es-AR")}
              </Text>
            )}
            <TextInput
              style={styles.modalInput}
              value={counterPrice}
              onChangeText={setCounterPrice}
              keyboardType="numeric"
              placeholder="Nuevo precio"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setCounterModal(null); setCounterPrice(""); }}
                disabled={counterSending}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleCounter} disabled={counterSending}>
                {counterSending
                  ? <ActivityIndicator size="small" color={colors.bg} />
                  : <Text style={styles.modalConfirmText}>Enviar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  backBtn: { paddingVertical: 4 },
  backText: { fontSize: typography.size.base, color: colors.brand, fontWeight: typography.fontWeight.medium },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  editBtn: { fontSize: typography.size.sm, color: colors.brand, fontWeight: typography.fontWeight.medium },
  statusBadge: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: typography.size.xs, fontWeight: typography.fontWeight.semibold },
  deleteBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#ef4444",
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  deleteBtnText: { fontSize: typography.size.sm, fontWeight: typography.fontWeight.semibold, color: "#ef4444" },

  scroll: { padding: 20, gap: 16, paddingBottom: 48 },
  center: { paddingVertical: 24, alignItems: "center" },

  routeCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 16,
  },
  routeRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  routeCol: { flex: 1 },
  routeColRight: { alignItems: "flex-end" },
  routeLabel: { fontSize: typography.size.xs, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  routeCity: { fontSize: typography.size.lg, fontWeight: typography.fontWeight.bold, color: colors.white },
  routeExact: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
  routeArrow: { fontSize: typography.size.xl, color: colors.textMuted, marginTop: 20 },

  section: { gap: 8 },
  sectionTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  sectionBody: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    gap: 12,
  },
  rowLabel: { fontSize: typography.size.sm, color: colors.textMuted, flexShrink: 0 },
  rowValue: { fontSize: typography.size.sm, color: colors.white, fontWeight: typography.fontWeight.medium, textAlign: "right", flexShrink: 1 },

  // Código de entrega
  codeLoadingBox: { paddingVertical: 16, alignItems: "center" },
  codeBox: { padding: 16, alignItems: "center", gap: 4 },
  codeText: { fontSize: 28, fontWeight: typography.fontWeight.bold, color: colors.white, letterSpacing: 6 },
  codeCopy: { fontSize: typography.size.xs, color: colors.textMuted },
  codeUsedBadge: { marginTop: 6, borderWidth: 1, borderColor: "#22c55e", borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  codeUsedText: { fontSize: typography.size.xs, color: "#22c55e", fontWeight: typography.fontWeight.semibold },

  // Ofertas
  ofertasList: { gap: 10 },
  ofertaCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    gap: 10,
  },
  ofertaHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  ofertaDriver: { gap: 2, flexShrink: 1, marginRight: 12 },
  ofertaName: { fontSize: typography.size.md, fontWeight: typography.fontWeight.bold, color: colors.white },
  rating: { fontSize: typography.size.sm, color: "#facc15" },
  noRating: { fontSize: typography.size.xs, color: colors.textMuted },
  ofertaPriceCol: { alignItems: "flex-end" },
  ofertaPrice: { fontSize: typography.size.lg, fontWeight: typography.fontWeight.bold, color: colors.brandLight },
  ofertaCounter: { fontSize: typography.size.xs, color: colors.textMuted },
  ofertaNote: { fontSize: typography.size.sm, color: colors.textSecondary, fontStyle: "italic" },
  ofertaStatusRow: { alignItems: "flex-start" },
  ofertaStatusText: { fontSize: typography.size.xs, color: colors.textMuted },
  ofertaActions: { flexDirection: "row", gap: 8 },
  btnAccept: { flex: 1, backgroundColor: colors.brand, borderRadius: radius.sm, paddingVertical: 8, alignItems: "center" },
  btnAcceptText: { fontSize: typography.size.sm, fontWeight: typography.fontWeight.bold, color: colors.bg },
  btnCounter: { flex: 1, borderWidth: 1, borderColor: colors.brand, borderRadius: radius.sm, paddingVertical: 8, alignItems: "center" },
  btnCounterText: { fontSize: typography.size.sm, fontWeight: typography.fontWeight.medium, color: colors.brand },
  btnReject: { flex: 1, borderWidth: 1, borderColor: "#ef4444", borderRadius: radius.sm, paddingVertical: 8, alignItems: "center" },
  btnRejectText: { fontSize: typography.size.sm, fontWeight: typography.fontWeight.medium, color: "#ef4444" },

  // Tabs
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.brand },
  tabText: { fontSize: typography.size.sm, color: colors.textMuted, fontWeight: typography.fontWeight.medium },
  tabTextActive: { color: colors.brand },

  // Chat
  messagesList: { padding: 16, gap: 8, flexGrow: 1 },
  noMessages: { textAlign: "center", color: colors.textMuted, fontSize: typography.size.sm, marginTop: 40 },
  bubble: {
    maxWidth: "75%",
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: colors.brand },
  bubbleTheirs: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.1)" },
  bubbleText: { fontSize: typography.size.sm, color: colors.white },
  bubbleTextMine: { color: colors.bg },
  bubbleTime: { fontSize: 10, color: "rgba(255,255,255,0.5)", alignSelf: "flex-end" },
  bubbleTimeMine: { color: "rgba(0,0,0,0.4)" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  msgInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: typography.size.sm,
    color: colors.white,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  sendBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { fontSize: typography.size.sm, fontWeight: typography.fontWeight.bold, color: colors.bg },
  cameraBtn: {
    width: 36,
    height: 36,
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

  // Modal edición
  editModalBox: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 24,
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
    marginTop: "auto",
  },
  editForm: { gap: 12, paddingBottom: 8 },
  fieldLabel: { fontSize: typography.size.xs, color: colors.textMuted, fontWeight: typography.fontWeight.medium, marginBottom: -4 },
  modalInputMulti: { height: 80, textAlignVertical: "top" },

  // Modal contraoferta
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 24 },
  modalBox: {
    backgroundColor: "#1a1a1a",
    borderRadius: radius.lg,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { fontSize: typography.size.lg, fontWeight: typography.fontWeight.bold, color: colors.white },
  modalSubtitle: { fontSize: typography.size.sm, color: colors.textMuted },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: typography.size.md,
    color: colors.white,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  modalActions: { flexDirection: "row", gap: 10 },
  modalCancel: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 12, alignItems: "center" },
  modalCancelText: { fontSize: typography.size.sm, color: colors.textMuted },
  modalConfirm: { flex: 1, backgroundColor: colors.brand, borderRadius: radius.sm, paddingVertical: 12, alignItems: "center" },
  modalConfirmText: { fontSize: typography.size.sm, fontWeight: typography.fontWeight.bold, color: colors.bg },
});
