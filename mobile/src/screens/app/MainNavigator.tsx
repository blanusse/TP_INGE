import React from "react";
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
import { colors, typography } from "../../theme";
import { RootStackParamList } from "../../../App";
import { Viaje, Carga } from "../../api";

// ─── Stack param lists ────────────────────────────────────────────────────────

export type ViajesStackParamList = {
  ViajesList: undefined;
  ViajeDetalle: { viaje: Viaje };
};

export type CargasStackParamList = {
  CargasList: undefined;
  CargaDetalle: { carga: Carga };
};

type TabParamList = {
  ViajesTab: undefined;
  CargasTab: undefined;
  Perfil: undefined;
};

// ─── Nested stacks ────────────────────────────────────────────────────────────

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
  const handleLogout = () => {
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: "Welcome" }] })
    );
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
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            ViajesTab: "navigate-outline",
            CargasTab: "cube-outline",
            Perfil: "person-outline",
          };
          return (
            <Ionicons
              name={icons[route.name] ?? "ellipse-outline"}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="ViajesTab"
        component={ViajesNavigator}
        options={{ tabBarLabel: "Viajes" }}
      />
      <Tab.Screen
        name="CargasTab"
        component={CargasNavigator}
        options={{ tabBarLabel: "Cargas" }}
      />
      <Tab.Screen
        name="Perfil"
        children={() => <PerfilScreen onLogout={handleLogout} />}
      />
    </Tab.Navigator>
  );
}
