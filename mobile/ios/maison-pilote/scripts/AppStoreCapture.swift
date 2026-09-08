// Uniquement pour produire les captures de revue. Exclu des cibles distribuées.
import XCTest

final class AppStoreCapture: XCTestCase {
    func testCaptureScreens() throws {
        continueAfterFailure = false
        let environment = ProcessInfo.processInfo.environment
        let login = try XCTUnwrap(environment["IOS_SCREENSHOT_LOGIN"])
        let password = try XCTUnwrap(environment["IOS_SCREENSHOT_PASSWORD"])
        let family = try XCTUnwrap(environment["IOS_CAPTURE_FAMILY"])
        let app = XCUIApplication(bundleIdentifier: "expert.meilhac.maisonpilote")
        app.launchArguments = ["-AppleLanguages", "(fr)", "-AppleLocale", "fr_FR"]
        app.launch()
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
