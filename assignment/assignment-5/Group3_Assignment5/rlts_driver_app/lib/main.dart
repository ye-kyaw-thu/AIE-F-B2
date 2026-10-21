import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'state/app_state.dart';
import 'screens/login_screen.dart';
import 'screens/driver_home_screen.dart';

void main() {
  runApp(const RltsDriverApp());
}

class RltsDriverApp extends StatelessWidget {
  const RltsDriverApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AppState()..hydrate(),
      child: MaterialApp(
        title: "RLTS-MM Driver",
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorSchemeSeed: const Color(0xFF0EA5E9),
          useMaterial3: true,
          scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        ),
        home: const RootRouter(),
      ),
    );
  }
}

class RootRouter extends StatelessWidget {
  const RootRouter({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    if (!app.hydrated) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return app.session == null ? const LoginScreen() : const DriverHomeScreen();
  }
}
