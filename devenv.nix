{ pkgs, ... }:

{
  imports = [ /workspace/common/main/devenv.nix ];

  packages = with pkgs; [
    curl
  ];
}
