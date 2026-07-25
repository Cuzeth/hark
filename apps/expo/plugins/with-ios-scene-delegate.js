const fs = require("node:fs");
const path = require("node:path");
const {
  IOSConfig,
  withAppDelegate,
  withInfoPlist,
  withXcodeProject,
} = require("expo/config-plugins");

const sceneDelegate = `internal import Expo
import React

/** Compatibility shim for Expo SDK 57 when building with Xcode 27. */
@objc(SceneDelegate)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard
      let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let factory = appDelegate.reactNativeFactory
    else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    factory.startReactNative(withModuleName: "main", in: window, launchOptions: nil)

    for context in connectionOptions.urlContexts {
      route(context, through: appDelegate)
    }
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    (UIApplication.shared.delegate as? AppDelegate)?.applicationDidBecomeActive(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    (UIApplication.shared.delegate as? AppDelegate)?.applicationWillResignActive(UIApplication.shared)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    (UIApplication.shared.delegate as? AppDelegate)?.applicationWillEnterForeground(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    (UIApplication.shared.delegate as? AppDelegate)?.applicationDidEnterBackground(UIApplication.shared)
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    for context in URLContexts {
      route(context, through: appDelegate)
    }
  }

  private func route(_ context: UIOpenURLContext, through appDelegate: AppDelegate) {
    var options: [UIApplication.OpenURLOptionsKey: Any] = [.openInPlace: context.options.openInPlace]
    if let sourceApplication = context.options.sourceApplication {
      options[.sourceApplication] = sourceApplication
    }
    if let annotation = context.options.annotation {
      options[.annotation] = annotation
    }
    _ = appDelegate.application(UIApplication.shared, open: context.url, options: options)
  }
}
`;

module.exports = function withIosSceneDelegate(config) {
  config = withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== "swift") {
      throw new Error("The iOS SceneDelegate compatibility plugin requires a Swift AppDelegate");
    }
    const startPattern =
      /\n\s*factory\.startReactNative\([\s\S]*?launchOptions:\s*launchOptions\s*\)\n/;
    if (startPattern.test(mod.modResults.contents)) {
      mod.modResults.contents = mod.modResults.contents.replace(startPattern, "\n");
    }
    if (!mod.modResults.contents.includes("internal import ExpoWidgets")) {
      mod.modResults.contents = mod.modResults.contents.replace(
        "internal import Expo\n",
        "internal import Expo\ninternal import ExpoWidgets\n",
      );
    }
    if (!mod.modResults.contents.includes("HarkLiveActivityTokenRegistrar.start()")) {
      mod.modResults.contents = mod.modResults.contents.replace(
        "    reactNativeFactory = factory\n",
        "    reactNativeFactory = factory\n\n    HarkLiveActivityTokenRegistrar.start()\n",
      );
    }
    mod.modResults.contents = mod.modResults.contents.replace(
      /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n#endif\n/,
      "\n",
    );
    return mod;
  });

  config = withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
          },
        ],
      },
    };
    return mod;
  });

  return withXcodeProject(config, (mod) => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(mod.modRequest.projectRoot);
    const filePath = path.join(projectName, "SceneDelegate.swift");
    const absolutePath = path.join(mod.modRequest.platformProjectRoot, filePath);
    fs.writeFileSync(absolutePath, sceneDelegate, "utf8");
    if (!mod.modResults.hasFile(filePath)) {
      mod.modResults = IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: filePath,
        groupName: projectName,
        project: mod.modResults,
      });
    }
    return mod;
  });
};
