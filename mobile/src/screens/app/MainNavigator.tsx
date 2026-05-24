import React from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ViajesScreen } from "./ViajesScreen";
import { ViajeDetalleScreen } from "./ViajeDetalleScreen";
import { CargasScreen } from "./CargasScreen";
import { CargaDetalleScreen } from "./CargaDetalleScreen";
import { PerfilScreen } from "./PerfilScreen";
import { MisCargasScreen } from "./MisCargasScreen";
import { MisEnviosScreen } from "./MisEnviosScreen";
import { MiCargaDetalleScreen } from "./MiCargaDetalleScreen";
import { NuevaCargaScreen } from "./NuevaCargaScreen";
import { colors, typography, radius } from "../../theme";
import { RootStackParamList } from "../../../App";
import { Viaje, Carga, MiCarga, isFleetEmployee, isShipper } from "../../api";
import { DocumentosTransportistaScreen } from "./DocumentosTransportistaScreen";

// ─── Stack param lists ────────────────────────────────────────────────────────

export type ViajesStackParamList = {
  ViajesList: undefined;
  ViajeDetalle: { viaje: Viaje };
};

export type CargasStackParamList = {
  CargasList: undefined;
  CargaDetalle: { carga: Carga };
};

export type MisCargasStackParamList = {
  MisCargasList: undefined;
  MiCargaDetalle: { carga: MiCarga };
};

export type MisEnviosStackParamList = {
  MisEnviosList: undefined;
  MiCargaDetalle: { carga: MiCarga };
};

type TabParamList = {
  ViajesTab: undefined;
  CargasTab: undefined;
  DocumentosTab: undefined;
  MisCargasTab: undefined;
  NuevaCargaTab: undefined;
  MisEnviosTab: undefined;
  Perfil: undefined;
};

// ─── Nested stacks ────────────────────────────────────────────────────────────

const MisCargasStack = createNativeStackNavigator<MisCargasStackParamList>();
function MisCargasNavigator() {
  return (
    <MisCargasStack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <MisCargasStack.Screen name="MisCargasList" component={MisCargasScreen} />
      <MisCargasStack.Screen name="MiCargaDetalle" component={MiCargaDetalleScreen} />
    </MisCargasStack.Navigator>
  );
}

const MisEnviosStack = createNativeStackNavigator<MisEnviosStackParamList>();
function MisEnviosNavigator() {
  return (
    <MisEnviosStack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <MisEnviosStack.Screen name="MisEnviosList" component={MisEnviosScreen} />
      <MisEnviosStack.Screen name="MiCargaDetalle" component={MiCargaDetalleScreen} />
    </MisEnviosStack.Navigator>
  );
}

const ViajesStack = createNativeStackNavigator<ViajesStackParamList>();
function ViajesNavigator() {
  return (
    <ViajesStack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <ViajesStack.Screen name="ViajesList" component={ViajesScreen} />
      <ViajesStack.Screen name="ViajeDetalle" component={ViajeDetalleScreen} />
    </ViajesStack.Navigator>
  );
}

const CargasStack = createNativeStackNavigator<CargasStackParamList>();
function CargasNavigator() {
  return (
    <CargasStack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <CargasStack.Screen name="CargasList" component={CargasScreen} />
      <CargasStack.Screen name="CargaDetalle" component={CargaDetalleScreen} />
    </CargasStack.Navigator>
  );
}

// ─── Tab navigator ────────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<TabParamList>();

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Main">;
};

export function MainNavigator({ navigation }: Props) {
  const fleetEmployee = isFleetEmployee();
  const shipper = isShipper();

  const handleLogout = () => {
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: "Welcome" }] })
    );
  };

  const tabBarIcon = ({ route, color, size }: { route: { name: string }; color: string; size: number }) => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      ViajesTab:      "navigate-outline",
      CargasTab:      "cube-outline",
      DocumentosTab:  "document-text-outline",
      MisCargasTab:   "albums-outline",
      MisEnviosTab:   "paper-plane-outline",
      Perfil:         "person-outline",
    };
    return <Ionicons name={icons[route.name] ?? "ellipse-outline"} size={size} color={color} />;
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0a0a0a",
          borderTopColor: "rgba(255,255,255,0.1)",
          borderTopWidth: 0.5,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: typography.fontWeight.medium,
        },
        tabBarIcon: ({ color, size }) => tabBarIcon({ route, color, size }),
      })}
    >
      {shipper ? (
        <>
          <Tab.Screen
            name="MisCargasTab"
            component={MisCargasNavigator}
            options={{ tabBarLabel: "Cargas" }}
          />
          <Tab.Screen
            name="NuevaCargaTab"
            component={NuevaCargaScreen}
            options={{
              tabBarLabel: "",
              tabBarButton: (props) => (
                <TouchableOpacity
                  style={tabStyles.fabWrapper}
                  onPress={props.onPress as () => void}
                  activeOpacity={0.85}
                >
                  <View style={tabStyles.fab}>
                    <Text style={tabStyles.fabPlus}>+</Text>
                  </View>
                </TouchableOpacity>
              ),
            }}
          />
          <Tab.Screen
            name="MisEnviosTab"
            component={MisEnviosNavigator}
            options={{ tabBarLabel: "Envíos" }}
          />
        </>
      ) : (
        <>
          <Tab.Screen
            name="ViajesTab"
            component={ViajesNavigator}
            options={{ tabBarLabel: "Viajes" }}
          />
          {!fleetEmployee && (
            <Tab.Screen
              name="CargasTab"
              component={CargasNavigator}
              options={{ tabBarLabel: "Cargas" }}
            />
          )}
          {!fleetEmployee && (
            <Tab.Screen
              name="DocumentosTab"
              component={DocumentosTransportistaScreen}
              options={{ tabBarLabel: "Documentos" }}
            />
          )}
        </>
      )}
      <Tab.Screen
        name="Perfil"
        children={() => <PerfilScreen onLogout={handleLogout} />}
      />
    </Tab.Navigator>
  );
}

const tabStyles = StyleSheet.create({
  fabWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 8,
  },
  fabPlus: {
    fontSize: 30,
    color: "#000",
    fontWeight: "bold",
    lineHeight: 34,
  },
});
