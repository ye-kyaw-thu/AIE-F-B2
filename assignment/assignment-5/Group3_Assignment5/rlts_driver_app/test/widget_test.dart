import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:rlts_driver_app/main.dart';

void main() {
  testWidgets('App boots to the login screen when signed out', (WidgetTester tester) async {
    // shared_preferences needs a mock in a test environment; TestWidgetsFlutterBinding
    // handles that automatically for plugin channel calls used by SharedPreferences.
    await tester.pumpWidget(const RltsDriverApp());
    await tester.pumpAndSettle();

    expect(find.text('Sign In'), findsOneWidget);
    expect(find.byType(TextField), findsNWidgets(2)); // username + password
  });
}
