// Uniquement pour produire les captures de revue. Exclu des cibles distribuées.
import XCTest

final class AppStoreCapture: XCTestCase {
    override func tearDown() {
        if testRun?.hasSucceeded == false {
            let family = ProcessInfo.processInfo.environment["IOS_CAPTURE_FAMILY"] ?? "iphone"
            attachScreen(named: family + "-diagnostic")
            print(String(XCUIApplication(bundleIdentifier: "expert.meilhac.maisonpilote").debugDescription.prefix(12000)))
        }
        super.tearDown()
    }

    func testCaptureScreens() throws {
        continueAfterFailure = false
        let environment = ProcessInfo.processInfo.environment
        let login = try XCTUnwrap(environment["IOS_SCREENSHOT_LOGIN"])
        let password = try XCTUnwrap(environment["IOS_SCREENSHOT_PASSWORD"])
        let family = try XCTUnwrap(environment["IOS_CAPTURE_FAMILY"])
        let app = XCUIApplication(bundleIdentifier: "expert.meilhac.maisonpilote")
        app.launchArguments = ["-AppleLanguages", "(fr)", "-AppleLocale", "fr_FR"]
        app.launch()
        Thread.sleep(forTimeInterval: 3)
        let identifier = app.webViews.textFields.firstMatch
        XCTAssertTrue(identifier.waitForExistence(timeout: 90), "Écran de connexion indisponible")
        identifier.tap()
        identifier.typeText(login)
        let passwordField = app.webViews.secureTextFields.firstMatch
        XCTAssertTrue(passwordField.waitForExistence(timeout: 15))
        passwordField.tap()
        passwordField.typeText(password)
        app.webViews.buttons["Se connecter"].firstMatch.tap()
        let documents = app.webViews.buttons["Documents"].firstMatch
        XCTAssertTrue(documents.waitForExistence(timeout: 90), "Accueil de démonstration indisponible")
        let systemAlert = XCUIApplication(bundleIdentifier: "com.apple.springboard").alerts.firstMatch
        if systemAlert.waitForExistence(timeout: 5) {
            let allow = systemAlert.buttons.matching(NSPredicate(format: "label IN %@", ["Autoriser", "Allow"])).firstMatch
            XCTAssertTrue(allow.exists, "Une alerte système inattendue empêche la capture")
            allow.tap()
        }
        if app.webViews.staticTexts["Activer la connexion biométrique ?"].firstMatch.waitForExistence(timeout: 5) {
            app.webViews.buttons["Fermer"].firstMatch.tap()
        }
        Thread.sleep(forTimeInterval: 3)
        attachScreen(named: family + "-01-accueil")
        documents.tap()
        Thread.sleep(forTimeInterval: 5)
        attachScreen(named: family + "-02-documents")
    }

    private func attachScreen(named name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
