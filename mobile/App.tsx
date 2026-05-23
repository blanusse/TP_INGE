import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { WelcomeScreen } from "./src/screens/WelcomeScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { RegisterRoleScreen } from "./src/screens/RegisterRoleScreen";
import { RegisterFormScreen } from "./src/screens/RegisterFormScreen";

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  RegisterRole: undefined;
  RegisterForm: { role: "transportista" | "empleado" };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{ headerShown: false, animation: "slide_from_right" }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="RegisterRole" component={RegisterRoleScreen} />
        <Stack.Screen name="RegisterForm" component={RegisterFormScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
